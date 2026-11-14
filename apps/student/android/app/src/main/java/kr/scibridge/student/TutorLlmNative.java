package kr.scibridge.student;

/**
 * tutor_llm.cpp(JNI)의 자바 쪽 입구. 호출은 TutorLlmPlugin의 단일 스레드 실행기에서만 한다(nativeAbort 제외).
 */
final class TutorLlmNative {
    private TutorLlmNative() {}

    static {
        System.loadLibrary("tutor_llm");
    }

    /** 한 번만: CPU 변형 라이브러리(libggml-cpu-*.so)를 libDir에서 불러오고 백엔드를 시작한다. */
    static native void nativeInit(String libDir);

    /** 모델과 컨텍스트를 올린다. 실패하면 RuntimeException. 반환: 실제 컨텍스트 크기. */
    static native int nativeLoad(String path, int nCtx, int nThreads);

    /** 진행 중인 생성을 되도록 빨리 멈추게 한다. 어느 스레드에서든 부를 수 있다. */
    static native void nativeAbort();

    static native void nativeUnload();

    /**
     * 탐욕 생성. prompt와 stop은 표준 UTF-8 바이트(String.getBytes(UTF_8))다(JNI 문자열은 변형 UTF-8이라 이모지가 깨진다). stats = {firstTokenMs, tokensPerSec, tokens}가 채워진다.
     * 반환: 멈춤 문자열 앞까지의 UTF-8 바이트.
     */
    static native byte[] nativeGenerate(
            byte[] prompt, int maxTokens, byte[][] stop, int[] suppressTokenIds, double[] stats);
}
