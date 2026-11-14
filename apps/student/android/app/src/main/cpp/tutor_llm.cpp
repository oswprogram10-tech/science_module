// 튜터 모델 기기 실행 JNI(사양 docs/specs/tutor-on-device-v1.md §4.1).
// - 모델 하나, 컨텍스트 하나. 호출은 TutorLlmPlugin의 단일 스레드 실행기에서만 오므로 로드/생성/해제가 겹치지 않는다
//   (예외: nativeAbort는 다른 스레드에서 올 수 있어 원자 변수만 만진다).
// - 프롬프트·생성 글은 로그로 남기지 않는다(학생 말이 들어 있을 수 있다).
#include <android/log.h>
#include <jni.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

#include "ggml-backend.h"
#include "llama.h"

#define LOG_TAG "TutorLlm"
#define LOGi(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGe(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

llama_model*   g_model = nullptr;
llama_context* g_ctx = nullptr;
// KV 캐시에 들어 있는 토큰(프롬프트 + 생성한 토큰). 다음 프롬프트와 앞부분이 같으면 그만큼 다시 계산하지 않는다(시스템 문장은 늘 같다).
std::vector<llama_token> g_cached;
int32_t g_n_ctx = 0;
std::atomic<bool> g_abort{false};
bool g_backend_ready = false;

using Clock = std::chrono::steady_clock;
double ms_since(Clock::time_point t0) {
  return std::chrono::duration<double, std::milli>(Clock::now() - t0).count();
}

void throw_java(JNIEnv* env, const char* msg) {
  jclass cls = env->FindClass("java/lang/RuntimeException");
  if (cls) env->ThrowNew(cls, msg);
}

void log_callback(ggml_log_level level, const char* text, void*) {
  // 경고 이상만 남긴다(모델 정보 줄은 많고 쓸모가 적다).
  if (level == GGML_LOG_LEVEL_ERROR) __android_log_write(ANDROID_LOG_ERROR, LOG_TAG, text);
  else if (level == GGML_LOG_LEVEL_WARN) __android_log_write(ANDROID_LOG_WARN, LOG_TAG, text);
}

bool abort_callback(void*) { return g_abort.load(std::memory_order_relaxed); }

void free_all() {
  if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
  if (g_model) { llama_model_free(g_model); g_model = nullptr; }
  g_cached.clear();
  g_cached.shrink_to_fit();
  g_n_ctx = 0;
}

std::string to_std(JNIEnv* env, jstring s) {
  if (!s) return {};
  const char* c = env->GetStringUTFChars(s, nullptr);
  std::string out(c ? c : "");
  if (c) env->ReleaseStringUTFChars(s, c);
  return out;
}

// 끝에 잘려 남은 UTF-8 글자 조각(최대 토큰 수에서 끊긴 경우)을 떼어 낸다.
void trim_incomplete_utf8(std::string& s) {
  size_t n = s.size();
  size_t back = 0;
  while (back < 4 && back < n) {
    unsigned char c = static_cast<unsigned char>(s[n - 1 - back]);
    if ((c & 0xC0) == 0x80) { back++; continue; }  // 이어지는 바이트
    size_t need = (c >= 0xF0) ? 4 : (c >= 0xE0) ? 3 : (c >= 0xC0) ? 2 : 1;
    if (need > back + 1) s.resize(n - 1 - back);  // 시작 바이트인데 뒤가 모자란다
    return;
  }
}

}  // namespace

extern "C" {

// 한 번만: 로그 연결, CPU 변형 라이브러리(libggml-cpu-*.so) 불러오기, 백엔드 시작.
JNIEXPORT void JNICALL Java_kr_scibridge_student_TutorLlmNative_nativeInit(JNIEnv* env, jclass, jstring libDir) {
  if (g_backend_ready) return;
  llama_log_set(log_callback, nullptr);
  const std::string dir = to_std(env, libDir);
  ggml_backend_load_all_from_path(dir.c_str());
  llama_backend_init();
  g_backend_ready = true;
  LOGi("backend ready (%s)", dir.c_str());
}

// 반환: 불러온 컨텍스트 크기. 실패하면 RuntimeException.
JNIEXPORT jint JNICALL Java_kr_scibridge_student_TutorLlmNative_nativeLoad(
    JNIEnv* env, jclass, jstring path, jint nCtx, jint nThreads) {
  if (!g_backend_ready) { throw_java(env, "backend not initialized"); return 0; }
  free_all();
  const std::string p = to_std(env, path);

  llama_model_params mp = llama_model_default_params();
  mp.n_gpu_layers = 0;
  g_model = llama_model_load_from_file(p.c_str(), mp);
  if (!g_model) { throw_java(env, "model load failed"); return 0; }

  llama_context_params cp = llama_context_default_params();
  cp.n_ctx = static_cast<uint32_t>(nCtx);
  cp.n_batch = std::min<uint32_t>(512, cp.n_ctx);
  cp.n_ubatch = cp.n_batch;
  cp.n_threads = nThreads;
  cp.n_threads_batch = nThreads;
  cp.no_perf = true;
  cp.abort_callback = abort_callback;
  cp.abort_callback_data = nullptr;
  g_ctx = llama_init_from_model(g_model, cp);
  if (!g_ctx) { free_all(); throw_java(env, "context init failed"); return 0; }
  g_n_ctx = static_cast<int32_t>(llama_n_ctx(g_ctx));
  g_abort.store(false);
  return g_n_ctx;
}

JNIEXPORT void JNICALL Java_kr_scibridge_student_TutorLlmNative_nativeAbort(JNIEnv*, jclass) {
  g_abort.store(true);
}

JNIEXPORT void JNICALL Java_kr_scibridge_student_TutorLlmNative_nativeUnload(JNIEnv*, jclass) {
  free_all();
  g_abort.store(false);
}

// 탐욕 생성. stats = {firstTokenMs, tokensPerSec, tokens}. 반환: UTF-8 바이트(멈춤 문자열 앞까지).
JNIEXPORT jbyteArray JNICALL Java_kr_scibridge_student_TutorLlmNative_nativeGenerate(
    JNIEnv* env, jclass, jstring jprompt, jint maxTokens, jobjectArray jstop, jintArray jsuppress, jdoubleArray jstats) {
  if (!g_ctx || !g_model) { throw_java(env, "model not loaded"); return nullptr; }
  g_abort.store(false);
  const auto t0 = Clock::now();

  const std::string prompt = to_std(env, jprompt);
  std::vector<std::string> stops;
  if (jstop) {
    const jsize n = env->GetArrayLength(jstop);
    for (jsize i = 0; i < n; i++) {
      jstring s = static_cast<jstring>(env->GetObjectArrayElement(jstop, i));
      std::string v = to_std(env, s);
      env->DeleteLocalRef(s);
      if (!v.empty()) stops.push_back(std::move(v));
    }
  }

  const llama_vocab* vocab = llama_model_get_vocab(g_model);
  const int32_t n_vocab = llama_vocab_n_tokens(vocab);

  // 프롬프트 토큰화: 특수 토큰(<|im_start|> 등)을 해석한다. BOS는 모델 설정에 따른다(Qwen은 없음).
  std::vector<llama_token> toks(prompt.size() + 8);
  int32_t n_tok = llama_tokenize(vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()), toks.data(),
                                 static_cast<int32_t>(toks.size()), true, true);
  if (n_tok < 0) {
    toks.resize(static_cast<size_t>(-n_tok));
    n_tok = llama_tokenize(vocab, prompt.c_str(), static_cast<int32_t>(prompt.size()), toks.data(),
                           static_cast<int32_t>(toks.size()), true, true);
  }
  if (n_tok <= 0) { throw_java(env, "tokenize failed"); return nullptr; }
  toks.resize(static_cast<size_t>(n_tok));
  if (n_tok >= g_n_ctx - 1) { throw_java(env, "prompt too long"); return nullptr; }
  const int32_t max_new = std::min<int32_t>(maxTokens, g_n_ctx - n_tok);

  // 샘플러: 금지 토큰 로짓 -무한대 → 탐욕.
  llama_sampler* smpl = llama_sampler_chain_init(llama_sampler_chain_default_params());
  if (jsuppress) {
    const jsize n = env->GetArrayLength(jsuppress);
    std::vector<jint> ids(static_cast<size_t>(n));
    if (n > 0) env->GetIntArrayRegion(jsuppress, 0, n, ids.data());
    std::vector<llama_logit_bias> bias;
    bias.reserve(ids.size());
    for (jint id : ids) {
      if (id >= 0 && id < n_vocab) bias.push_back({static_cast<llama_token>(id), -INFINITY});
    }
    if (!bias.empty()) {
      llama_sampler_chain_add(smpl, llama_sampler_init_logit_bias(n_vocab, static_cast<int32_t>(bias.size()), bias.data()));
    }
  }
  llama_sampler_chain_add(smpl, llama_sampler_init_greedy());

  // 앞부분이 같은 토큰은 KV 캐시를 재사용한다. 마지막 토큰은 로짓을 얻으려고 항상 새로 계산한다.
  llama_memory_t mem = llama_get_memory(g_ctx);
  size_t keep = 0;
  while (keep < g_cached.size() && keep < toks.size() && g_cached[keep] == toks[keep]) keep++;
  if (keep >= toks.size()) keep = toks.size() - 1;
  if (keep == 0 || !llama_memory_seq_rm(mem, 0, static_cast<llama_pos>(keep), -1)) {
    llama_memory_clear(mem, true);
    keep = 0;
  }
  g_cached.assign(toks.begin(), toks.begin() + static_cast<long>(keep));

  auto fail = [&](const char* msg) -> jbyteArray {
    llama_sampler_free(smpl);
    llama_memory_clear(mem, true);
    g_cached.clear();
    throw_java(env, msg);
    return nullptr;
  };

  // 프롬프트 채우기(배치 크기 단위).
  const int32_t chunk = static_cast<int32_t>(std::min<uint32_t>(512, static_cast<uint32_t>(g_n_ctx)));
  for (size_t i = keep; i < toks.size();) {
    const int32_t n = std::min<int32_t>(chunk, static_cast<int32_t>(toks.size() - i));
    llama_batch b = llama_batch_get_one(toks.data() + i, n);
    if (llama_decode(g_ctx, b) != 0) return fail(g_abort.load() ? "aborted" : "decode failed");
    for (int32_t k = 0; k < n; k++) g_cached.push_back(toks[i + static_cast<size_t>(k)]);
    i += static_cast<size_t>(n);
  }

  std::string out;
  double first_ms = 0;
  Clock::time_point t_first;
  int32_t n_gen = 0;
  char piece[256];
  bool stopped = false;
  for (int32_t step = 0; step < max_new && !stopped; step++) {
    if (g_abort.load()) break;
    llama_token tok = llama_sampler_sample(smpl, g_ctx, -1);
    if (step == 0) { first_ms = ms_since(t0); t_first = Clock::now(); }
    if (llama_vocab_is_eog(vocab, tok)) break;
    n_gen++;
    const int32_t len = std::max<int32_t>(0, llama_token_to_piece(vocab, tok, piece, sizeof(piece), 0, false));
    if (len > 0) out.append(piece, static_cast<size_t>(len));
    // 멈춤 문자열: 가장 앞에서 찾은 것 앞까지만 남긴다.
    size_t cut = std::string::npos;
    for (const auto& s : stops) {
      const size_t from = out.size() > s.size() + static_cast<size_t>(len) ? out.size() - s.size() - static_cast<size_t>(len) : 0;
      const size_t pos = out.find(s, from);
      if (pos != std::string::npos && pos < cut) cut = pos;
    }
    if (cut != std::string::npos) { out.resize(cut); stopped = true; break; }
    if (step + 1 >= max_new) break;
    llama_batch b = llama_batch_get_one(&tok, 1);
    if (llama_decode(g_ctx, b) != 0) {  // 중단되었거나 컨텍스트가 찼다: 지금까지의 글을 돌려 주고, 캐시는 믿지 않는다.
      llama_memory_clear(mem, true);
      g_cached.clear();
      break;
    }
    g_cached.push_back(tok);
  }
  const double decode_ms = n_gen > 1 ? ms_since(t_first) : 0;
  llama_sampler_free(smpl);

  trim_incomplete_utf8(out);
  if (jstats && env->GetArrayLength(jstats) >= 3) {
    const jdouble stats[3] = {first_ms, decode_ms > 0 ? (n_gen - 1) * 1000.0 / decode_ms : 0.0, static_cast<jdouble>(n_gen)};
    env->SetDoubleArrayRegion(jstats, 0, 3, stats);
  }
  jbyteArray result = env->NewByteArray(static_cast<jsize>(out.size()));
  if (result && !out.empty()) env->SetByteArrayRegion(result, 0, static_cast<jsize>(out.size()), reinterpret_cast<const jbyte*>(out.data()));
  return result;
}

}  // extern "C"
