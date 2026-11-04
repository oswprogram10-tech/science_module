/** 주소에 `?dev=1`이 있으면 개발용 패널을 보인다. */
export const devMode = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('dev') === '1';
  } catch {
    return false;
  }
};
