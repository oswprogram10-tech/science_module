package kr.scibridge.student;

import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * 기기 안 튜터 모델(llama.cpp) 플러그인(사양 docs/specs/tutor-on-device-v1.md §4.1).
 * 인터페이스는 apps/student/src/tutor/llmPlugin.ts. 모델 파일은 앱 전용 저장소(files/tutor-models/)에만 둔다.
 * 프롬프트·생성 글은 이 안(기기)에서만 쓰고 로그나 네트워크로 내보내지 않는다. 네트워크는 download의 url(교사 PC)로만 나간다.
 * 스레드: 내려받기(dl), 파일 조회·삭제(io), 모델 로드·생성·해제(llm)는 각각 단일 스레드 실행기에서 한다. 메인 스레드는 막지 않는다.
 */
@CapacitorPlugin(name = "TutorLlm")
public class TutorLlmPlugin extends Plugin {
    private static final String TAG = "TutorLlm";
    private static final String DIR_NAME = "tutor-models";
    /** 파일 이름: 영문·숫자·점·밑줄·붙임표, .gguf로 끝남(경로 구분자·".." 불가). */
    private static final Pattern FILE_NAME = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\\.gguf$");
    private static final Pattern SHA256 = Pattern.compile("^[0-9a-fA-F]{64}$");
    private static final long PROGRESS_INTERVAL_MS = 250;
    private static final int MAX_PROMPT_CHARS = 32_000;
    private static final int MAX_STOPS = 16;
    private static final int MAX_STOP_CHARS = 64;
    private static final int MAX_SUPPRESS = 200_000;

    private final ExecutorService dlExecutor = Executors.newSingleThreadExecutor(r -> new Thread(r, "tutor-dl"));
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor(r -> new Thread(r, "tutor-io"));
    private final ExecutorService llmExecutor = Executors.newSingleThreadExecutor(r -> new Thread(r, "tutor-llm"));
    private final Set<String> downloading = ConcurrentHashMap.newKeySet();

    // llm 실행기에서만 바꾼다(읽기는 다른 스레드에서도 하므로 volatile).
    private volatile boolean nativeReady = false;
    private volatile String loadedFile = null;

    // ---- 파일 ----

    private File modelDir() {
        File dir = new File(getContext().getFilesDir(), DIR_NAME);
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new IllegalStateException("모델 폴더를 만들 수 없어요");
        }
        return dir;
    }

    /** 이름을 검사해 모델 폴더 안의 파일만 돌려준다. 잘못된 이름이면 null. */
    private File modelFile(String name, String suffix) {
        if (name == null || !FILE_NAME.matcher(name).matches() || name.contains("..")) return null;
        try {
            File dir = modelDir();
            File f = new File(dir, name + suffix);
            String base = dir.getCanonicalPath() + File.separator;
            return f.getCanonicalPath().startsWith(base) ? f : null;
        } catch (IOException | IllegalStateException e) {
            return null;
        }
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** 사이드카(<파일>.sha256): "<sha256> <크기>". 크기가 지금 파일과 같을 때만 믿는다. */
    private String readSidecar(File f, File side) {
        try {
            if (!side.isFile()) return null;
            String[] p = new String(Files.readAllBytes(side.toPath()), StandardCharsets.UTF_8).trim().split(" ");
            if (p.length == 2 && SHA256.matcher(p[0]).matches() && Long.parseLong(p[1]) == f.length()) return p[0].toLowerCase();
        } catch (IOException | NumberFormatException ignored) {
        }
        return null;
    }

    private void writeSidecar(File f, File side, String sha) {
        try {
            Files.write(side.toPath(), (sha.toLowerCase() + " " + f.length()).getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            Log.w(TAG, "sha256 사이드카를 쓰지 못했어요");
        }
    }

    private static String hashFile(File f) throws IOException {
        MessageDigest md = sha256();
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        return hex(md.digest());
    }

    // ---- download ----

    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final String sha = call.getString("sha256");
        final String file = call.getString("file");
        final File dest = modelFile(file, "");
        if (dest == null) {
            call.reject("잘못된 파일 이름이에요");
            return;
        }
        if (sha == null || !SHA256.matcher(sha).matches()) {
            call.reject("잘못된 sha256이에요");
            return;
        }
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            call.reject("잘못된 주소예요");
            return;
        }
        if (!downloading.add(file)) {
            call.reject("이미 내려받고 있어요");
            return;
        }
        dlExecutor.execute(() -> {
            try {
                call.resolve(doDownload(url, sha.toLowerCase(), file, dest));
            } catch (Throwable t) {
                // 끊긴 내려받기는 .part를 남겨 다시 부르면 이어 받는다.
                call.reject(t.getMessage() != null ? t.getMessage() : "내려받기에 실패했어요");
            } finally {
                downloading.remove(file);
            }
        });
    }

    private JSObject result(boolean ok, long size) {
        JSObject r = new JSObject();
        r.put("ok", ok);
        r.put("size", size);
        return r;
    }

    private JSObject doDownload(String url, String sha, String file, File dest) throws Exception {
        File side = modelFile(file, ".sha256");
        File part = modelFile(file, ".part");
        // 이미 같은 파일이 있으면 받지 않는다.
        if (dest.isFile()) {
            String have = readSidecar(dest, side);
            if (have == null) {
                have = hashFile(dest);
                writeSidecar(dest, side, have);
            }
            if (have.equals(sha)) return result(true, dest.length());
        }
        long offset = part.isFile() ? part.length() : 0;
        HttpURLConnection conn = open(url, offset);
        int code = conn.getResponseCode();
        if (code == 416 && offset > 0) { // 받아 둔 조각이 어긋났다: 처음부터
            conn.disconnect();
            part.delete();
            offset = 0;
            conn = open(url, 0);
            code = conn.getResponseCode();
        }
        try {
            if (code != 200 && code != 206) throw new IOException("서버 응답 " + code);
            if (code == 200) offset = 0; // 서버가 Range를 무시했다: 처음부터 받는다.
            long total = -1;
            if (code == 206) {
                String cr = conn.getHeaderField("Content-Range"); // bytes a-b/total
                int slash = cr == null ? -1 : cr.lastIndexOf('/');
                if (slash >= 0) {
                    try { total = Long.parseLong(cr.substring(slash + 1).trim()); } catch (NumberFormatException ignored) { }
                }
            }
            if (total < 0) {
                long len = conn.getContentLengthLong();
                total = len >= 0 ? len + offset : -1;
            }

            MessageDigest md = sha256();
            if (offset > 0) { // 이어 받을 때는 받아 둔 앞부분도 해시에 넣는다.
                try (InputStream in = new FileInputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
                }
            }
            long received = offset;
            long lastEmit = 0;
            try (InputStream in = conn.getInputStream(); FileOutputStream out = new FileOutputStream(part, offset > 0)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    md.update(buf, 0, n);
                    received += n;
                    long now = System.currentTimeMillis();
                    if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
                        lastEmit = now;
                        emitProgress(file, received, Math.max(total, 0));
                    }
                }
            }
            emitProgress(file, received, Math.max(total, received));
            if (total >= 0 && received != total) throw new IOException("내려받기가 중간에 끊겼어요");
            if (!hex(md.digest()).equals(sha)) {
                part.delete();
                throw new IOException("sha256이 맞지 않아요");
            }
            Files.move(part.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
            writeSidecar(dest, side, sha);
            return result(true, dest.length());
        } finally {
            conn.disconnect();
        }
    }

    private HttpURLConnection open(String url, long offset) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15_000);
        c.setReadTimeout(30_000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Accept-Encoding", "identity"); // 압축하면 Range·길이가 어긋난다.
        if (offset > 0) c.setRequestProperty("Range", "bytes=" + offset + "-");
        return c;
    }

    private void emitProgress(String file, long received, long total) {
        JSObject e = new JSObject();
        e.put("file", file);
        e.put("received", received);
        e.put("total", total);
        notifyListeners("progress", e);
    }

    // ---- fileInfo / remove ----

    @PluginMethod
    public void fileInfo(PluginCall call) {
        final File f = modelFile(call.getString("file"), "");
        if (f == null) {
            call.reject("잘못된 파일 이름이에요");
            return;
        }
        ioExecutor.execute(() -> {
            try {
                JSObject r = new JSObject();
                boolean exists = f.isFile();
                r.put("exists", exists);
                r.put("size", exists ? f.length() : 0);
                if (exists) {
                    File side = modelFile(f.getName(), ".sha256");
                    String sha = readSidecar(f, side);
                    if (sha == null) { // 한 번 계산해 두면 다음부터는 사이드카에서 읽는다.
                        sha = hashFile(f);
                        writeSidecar(f, side, sha);
                    }
                    r.put("sha256", sha);
                }
                call.resolve(r);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : "파일을 확인하지 못했어요");
            }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        final String name = call.getString("file");
        final File f = modelFile(name, "");
        if (f == null) {
            call.reject("잘못된 파일 이름이에요");
            return;
        }
        if (downloading.contains(name)) {
            call.reject("내려받는 중이에요");
            return;
        }
        // 올려 둔 모델이면 먼저 내린다(llm 실행기에서 차례대로).
        llmExecutor.execute(() -> {
            try {
                if (name.equals(loadedFile)) unloadNow();
                f.delete();
                File part = modelFile(name, ".part");
                File side = modelFile(name, ".sha256");
                if (part != null) part.delete();
                if (side != null) side.delete();
                call.resolve();
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : "지우지 못했어요");
            }
        });
    }

    // ---- load / generate / unload ----

    private void ensureInit() {
        if (nativeReady) return;
        TutorLlmNative.nativeInit(getContext().getApplicationInfo().nativeLibraryDir);
        nativeReady = true;
    }

    private void unloadNow() {
        if (nativeReady) TutorLlmNative.nativeUnload();
        loadedFile = null;
    }

    @PluginMethod
    public void load(PluginCall call) {
        final String name = call.getString("file");
        final File f = modelFile(name, "");
        final Integer nCtx = call.getInt("nCtx", 2048);
        final Integer nThreads = call.getInt("nThreads", 4);
        if (f == null) {
            call.reject("잘못된 파일 이름이에요");
            return;
        }
        if (nCtx == null || nCtx < 256 || nCtx > 8192 || nThreads == null || nThreads < 1 || nThreads > 16) {
            call.reject("nCtx(256~8192) 또는 nThreads(1~16)가 잘못됐어요");
            return;
        }
        llmExecutor.execute(() -> {
            try {
                if (!f.isFile()) throw new IOException("모델 파일이 없어요");
                ensureInit();
                long t0 = System.nanoTime();
                loadedFile = null;
                TutorLlmNative.nativeLoad(f.getAbsolutePath(), nCtx, nThreads);
                loadedFile = name;
                JSObject r = new JSObject();
                r.put("ok", true);
                r.put("loadMs", (System.nanoTime() - t0) / 1_000_000L);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : "모델을 올리지 못했어요");
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        final String prompt = call.getString("prompt");
        final int maxTokens = Math.max(1, Math.min(512, call.getInt("maxTokens", 96)));
        if (prompt == null || prompt.isEmpty() || prompt.length() > MAX_PROMPT_CHARS) {
            call.reject("잘못된 프롬프트예요");
            return;
        }
        final String[] stops;
        final int[] suppress;
        try {
            JSArray stopArr = call.getArray("stop");
            int ns = stopArr == null ? 0 : Math.min(stopArr.length(), MAX_STOPS);
            stops = new String[ns];
            for (int i = 0; i < ns; i++) {
                String s = stopArr.getString(i);
                stops[i] = s.length() > MAX_STOP_CHARS ? s.substring(0, MAX_STOP_CHARS) : s;
            }
            JSArray supArr = call.getArray("suppressTokenIds");
            int nu = supArr == null ? 0 : Math.min(supArr.length(), MAX_SUPPRESS);
            suppress = new int[nu];
            for (int i = 0; i < nu; i++) suppress[i] = supArr.getInt(i);
        } catch (JSONException e) {
            call.reject("stop 또는 suppressTokenIds 형식이 잘못됐어요");
            return;
        }
        llmExecutor.execute(() -> {
            try {
                if (loadedFile == null) throw new IllegalStateException("모델이 올라가 있지 않아요");
                double[] stats = new double[3];
                byte[] bytes = TutorLlmNative.nativeGenerate(prompt, maxTokens, stops, suppress, stats);
                JSObject r = new JSObject();
                r.put("text", new String(bytes == null ? new byte[0] : bytes, StandardCharsets.UTF_8));
                r.put("firstTokenMs", stats[0]);
                r.put("tokensPerSec", stats[1]);
                r.put("tokens", (long) stats[2]);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : "생성하지 못했어요");
            }
        });
    }

    @PluginMethod
    public void unload(PluginCall call) {
        // 생성 중이면 먼저 멈추게 한다(실행기는 단일 스레드라 해제는 그 뒤에 차례가 온다).
        if (nativeReady) TutorLlmNative.nativeAbort();
        llmExecutor.execute(() -> {
            try {
                unloadNow();
                call.resolve();
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : "내리지 못했어요");
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (nativeReady) TutorLlmNative.nativeAbort();
        llmExecutor.execute(this::unloadNow);
        llmExecutor.shutdown();
        dlExecutor.shutdownNow();
        ioExecutor.shutdown();
        super.handleOnDestroy();
    }
}
