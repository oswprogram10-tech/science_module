# 튜터 모델 기기 실행용 JNI 라이브러리(사양 docs/specs/tutor-on-device-v1.md §4.3).
# llama.cpp는 공식 저장소(ggml-org/llama.cpp) 소스를 고정한 태그로 FetchContent가 받아 직접 빌드한다.
# 남이 빌드한 .so나 래퍼 패키지는 쓰지 않는다.
cmake_minimum_required(VERSION 3.22)
project(tutor_llm LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---- llama.cpp 고정 버전: 태그와 커밋 해시를 모두 고정한다. 올릴 때는 둘을 함께 바꾼다. ----
set(TUTOR_LLAMA_TAG    "b12359")
set(TUTOR_LLAMA_COMMIT "b1b770d90d94cad9e9ea5b993bdbc383a522fb28")

# ---- llama.cpp 빌드 옵션: 필요한 것(llama + ggml CPU)만 ----
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON   OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP      OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL    OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE   OFF CACHE BOOL "" FORCE)   # 교차 빌드이므로 빌드 기계의 CPU에 맞추지 않는다.
set(GGML_OPENMP   OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)
# ARM 최적화: CPU 기능(dotprod, fp16, i8mm, SVE 등)별 변형 라이브러리를 모두 빌드하고, 실행할 때 기기 CPU에 맞는 것을 고른다.
# (옛 기기에서 지원하지 않는 명령어로 죽지 않으면서 최신 기기에서는 빠른 커널을 쓴다. 공식 llama.android 예제와 같은 방식.)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS ON CACHE BOOL "" FORCE)
if(ANDROID_ABI STREQUAL "arm64-v8a")
  set(GGML_SYSTEM_ARCH "ARM" CACHE STRING "" FORCE)
elseif(ANDROID_ABI STREQUAL "x86_64")
  set(GGML_SYSTEM_ARCH "x86" CACHE STRING "" FORCE)
endif()

include(FetchContent)
# 오프라인·캐시 빌드: -DFETCHCONTENT_SOURCE_DIR_LLAMA_CPP=<같은 태그의 소스 폴더>(Gradle: -PllamaCppDir=...)
FetchContent_Declare(llama_cpp
  GIT_REPOSITORY https://github.com/ggml-org/llama.cpp.git
  GIT_TAG        ${TUTOR_LLAMA_TAG}
  GIT_SHALLOW    ON)
FetchContent_MakeAvailable(llama_cpp)

# 받은 소스가 고정한 커밋과 같은지 확인한다(태그가 옮겨졌거나 다른 소스를 가리키면 빌드를 멈춘다).
find_package(Git REQUIRED)
execute_process(
  COMMAND ${GIT_EXECUTABLE} -C ${llama_cpp_SOURCE_DIR} rev-parse HEAD
  OUTPUT_VARIABLE TUTOR_LLAMA_ACTUAL_COMMIT
  OUTPUT_STRIP_TRAILING_WHITESPACE
  RESULT_VARIABLE TUTOR_LLAMA_REV_RESULT)
if(NOT TUTOR_LLAMA_REV_RESULT EQUAL 0 OR NOT TUTOR_LLAMA_ACTUAL_COMMIT STREQUAL TUTOR_LLAMA_COMMIT)
  message(FATAL_ERROR "llama.cpp 소스가 고정한 커밋과 다릅니다: 기대 ${TUTOR_LLAMA_COMMIT}(${TUTOR_LLAMA_TAG}), 실제 '${TUTOR_LLAMA_ACTUAL_COMMIT}'")
endif()
message(STATUS "llama.cpp ${TUTOR_LLAMA_TAG} (${TUTOR_LLAMA_ACTUAL_COMMIT})")

add_library(tutor_llm SHARED tutor_llm.cpp)
target_include_directories(tutor_llm PRIVATE ${llama_cpp_SOURCE_DIR}/include ${llama_cpp_SOURCE_DIR}/ggml/include)
target_link_libraries(tutor_llm PRIVATE llama ggml android log)
