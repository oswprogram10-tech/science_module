package kr.scibridge.student;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 기기 안 튜터 모델 플러그인(사양 docs/specs/tutor-on-device-v1.md §4). super.onCreate 전에 등록해야 한다.
        registerPlugin(TutorLlmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
