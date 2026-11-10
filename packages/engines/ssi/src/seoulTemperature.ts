/**
 * 서울 연평균기온(기상청 기상자료개방포털, 지점 108, 1907~2025).
 * content/data/kma-seoul-annual-temperature.csv를 그대로 옮긴 값이다(출처: content/data/README.md). 값이 없는 해는 meanC가 null이다.
 */
export interface SeoulYearTemperature {
  year: number;
  meanC: number | null;
}

export const SEOUL_ANNUAL_TEMPERATURE: readonly SeoulYearTemperature[] = [
  { year: 1907, meanC: null },
  { year: 1908, meanC: 10.4 },
  { year: 1909, meanC: 10.6 },
  { year: 1910, meanC: 10.3 },
  { year: 1911, meanC: 10.6 },
  { year: 1912, meanC: 10.1 },
  { year: 1913, meanC: 10.0 },
  { year: 1914, meanC: 12.0 },
  { year: 1915, meanC: 10.8 },
  { year: 1916, meanC: 10.9 },
  { year: 1917, meanC: 9.8 },
  { year: 1918, meanC: 10.5 },
  { year: 1919, meanC: 11.1 },
  { year: 1920, meanC: 11.4 },
  { year: 1921, meanC: 10.9 },
  { year: 1922, meanC: 10.8 },
  { year: 1923, meanC: 10.6 },
  { year: 1924, meanC: 11.0 },
  { year: 1925, meanC: 10.7 },
  { year: 1926, meanC: 10.5 },
  { year: 1927, meanC: 11.0 },
  { year: 1928, meanC: 11.1 },
  { year: 1929, meanC: 11.4 },
  { year: 1930, meanC: 11.8 },
  { year: 1931, meanC: 10.9 },
  { year: 1932, meanC: 11.6 },
  { year: 1933, meanC: 10.5 },
  { year: 1934, meanC: 10.1 },
  { year: 1935, meanC: 11.2 },
  { year: 1936, meanC: 9.8 },
  { year: 1937, meanC: 11.4 },
  { year: 1938, meanC: 10.9 },
  { year: 1939, meanC: 11.7 },
  { year: 1940, meanC: 10.8 },
  { year: 1941, meanC: 11.1 },
  { year: 1942, meanC: 10.9 },
  { year: 1943, meanC: 11.7 },
  { year: 1944, meanC: 10.9 },
  { year: 1945, meanC: 10.4 },
  { year: 1946, meanC: 11.3 },
  { year: 1947, meanC: 9.6 },
  { year: 1948, meanC: 11.7 },
  { year: 1949, meanC: 11.7 },
  { year: 1950, meanC: null },
  { year: 1951, meanC: null },
  { year: 1952, meanC: null },
  { year: 1953, meanC: null },
  { year: 1954, meanC: 11.4 },
  { year: 1955, meanC: 11.5 },
  { year: 1956, meanC: 10.1 },
  { year: 1957, meanC: 10.4 },
  { year: 1958, meanC: 11.6 },
  { year: 1959, meanC: 12.0 },
  { year: 1960, meanC: 12.1 },
  { year: 1961, meanC: 12.4 },
  { year: 1962, meanC: 11.7 },
  { year: 1963, meanC: 11.3 },
  { year: 1964, meanC: 12.2 },
  { year: 1965, meanC: 11.4 },
  { year: 1966, meanC: 11.5 },
  { year: 1967, meanC: 11.6 },
  { year: 1968, meanC: 11.8 },
  { year: 1969, meanC: 10.9 },
  { year: 1970, meanC: 11.4 },
  { year: 1971, meanC: 11.5 },
  { year: 1972, meanC: 11.9 },
  { year: 1973, meanC: 12.0 },
  { year: 1974, meanC: 11.1 },
  { year: 1975, meanC: 12.5 },
  { year: 1976, meanC: 11.5 },
  { year: 1977, meanC: 12.3 },
  { year: 1978, meanC: 12.4 },
  { year: 1979, meanC: 12.5 },
  { year: 1980, meanC: 10.8 },
  { year: 1981, meanC: 11.2 },
  { year: 1982, meanC: 12.5 },
  { year: 1983, meanC: 12.4 },
  { year: 1984, meanC: 11.6 },
  { year: 1985, meanC: 11.6 },
  { year: 1986, meanC: 11.2 },
  { year: 1987, meanC: 11.9 },
  { year: 1988, meanC: 12.1 },
  { year: 1989, meanC: 13.0 },
  { year: 1990, meanC: 12.8 },
  { year: 1991, meanC: 12.3 },
  { year: 1992, meanC: 12.5 },
  { year: 1993, meanC: 12.0 },
  { year: 1994, meanC: 13.5 },
  { year: 1995, meanC: 12.2 },
  { year: 1996, meanC: 12.2 },
  { year: 1997, meanC: 12.9 },
  { year: 1998, meanC: 13.8 },
  { year: 1999, meanC: 13.2 },
  { year: 2000, meanC: 12.7 },
  { year: 2001, meanC: 12.8 },
  { year: 2002, meanC: 12.9 },
  { year: 2003, meanC: 12.8 },
  { year: 2004, meanC: 13.3 },
  { year: 2005, meanC: 12.1 },
  { year: 2006, meanC: 13.0 },
  { year: 2007, meanC: 13.3 },
  { year: 2008, meanC: 12.9 },
  { year: 2009, meanC: 12.9 },
  { year: 2010, meanC: 12.1 },
  { year: 2011, meanC: 12.0 },
  { year: 2012, meanC: 12.2 },
  { year: 2013, meanC: 12.5 },
  { year: 2014, meanC: 13.4 },
  { year: 2015, meanC: 13.6 },
  { year: 2016, meanC: 13.6 },
  { year: 2017, meanC: 13.0 },
  { year: 2018, meanC: 12.9 },
  { year: 2019, meanC: 13.5 },
  { year: 2020, meanC: 13.2 },
  { year: 2021, meanC: 13.7 },
  { year: 2022, meanC: 13.2 },
  { year: 2023, meanC: 14.1 },
  { year: 2024, meanC: 14.9 },
  { year: 2025, meanC: 14.1 },
];

/** 값이 없는 해(1907: 관측을 10월에 시작, 1950~1953: 한국전쟁) */
export const SEOUL_MISSING_YEARS: readonly number[] = SEOUL_ANNUAL_TEMPERATURE.filter((d) => d.meanC === null).map((d) => d.year);

export interface PeriodMean {
  from: number;
  to: number;
  /** 값이 있는 해의 수 */
  count: number;
  /** 평균(°C). 값이 있는 해가 없으면 null */
  mean: number | null;
  /** 소수 첫째 자리까지 반올림(소수 둘째 자리에서 반올림, 0.05는 올림)한 값을 0.1 °C 단위 정수로 */
  tenths: number | null;
  /** 화면에 쓰는 글자(예: "10.8") */
  shown: string | null;
}

/** 자료는 소수 첫째 자리라 0.1 °C 단위 정수로 바꿔 더하면 부동소수 오차가 없다. */
const toTenths = (c: number) => Math.round(c * 10);

/** from~to(양 끝 포함)의 값이 있는 해만 평균한다. */
export function periodMean(from: number, to: number): PeriodMean {
  let sum = 0;
  let count = 0;
  for (const d of SEOUL_ANNUAL_TEMPERATURE) {
    if (d.year < from || d.year > to || d.meanC === null) continue;
    sum += toTenths(d.meanC);
    count++;
  }
  if (count === 0) return { from, to, count, mean: null, tenths: null, shown: null };
  // 평균 = sum/count (0.1 °C 단위). 반올림은 정수 나눗셈으로: floor((2·sum + count) / (2·count))
  const tenths = Math.floor((2 * sum + count) / (2 * count));
  const hundredths = Math.round((sum * 10) / count);
  return { from, to, count, mean: hundredths / 100, tenths, shown: `${Math.floor(tenths / 10)}.${tenths % 10}` };
}

/** 표로 보기용 10년 평균 기간(처음은 1908, 끝은 2025) */
export const SEOUL_DECADES: readonly (readonly [number, number])[] = [
  [1908, 1917], [1918, 1927], [1928, 1937], [1938, 1947], [1948, 1957], [1958, 1967],
  [1968, 1977], [1978, 1987], [1988, 1997], [1998, 2007], [2008, 2017], [2018, 2025],
];

export const seoulDecadeMeans = (): PeriodMean[] => SEOUL_DECADES.map(([a, b]) => periodMean(a, b));

export const SEOUL_FIRST_30 = [1908, 1937] as const;
export const SEOUL_LAST_30 = [1996, 2025] as const;
