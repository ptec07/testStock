const KOREAN_STOCK_PRESETS = [
  { symbol: '005930.KS', name: '삼성전자', aliases: ['삼성전자', '삼전', 'samsung electronics', 'samsung', '005930'] },
  { symbol: '000660.KS', name: 'SK하이닉스', aliases: ['sk하이닉스', '하이닉스', 'sk hynix', '000660'] },
  { symbol: '035420.KS', name: 'NAVER', aliases: ['naver', '네이버', '035420'] },
  { symbol: '035720.KS', name: '카카오', aliases: ['카카오', 'kakao', '035720'] },
  { symbol: '005380.KS', name: '현대차', aliases: ['현대차', '현대자동차', 'hyundai motor', '005380'] },
  { symbol: '012330.KS', name: '현대모비스', aliases: ['현대모비스', 'mobis', '012330'] },
  { symbol: '051910.KS', name: 'LG화학', aliases: ['lg화학', 'lg chem', '051910'] },
  { symbol: '006400.KS', name: '삼성SDI', aliases: ['삼성sdi', 'samsung sdi', '006400'] },
  { symbol: '003670.KS', name: '포스코홀딩스', aliases: ['포스코', '포스코홀딩스', 'posco', '003670'] },
  { symbol: '068270.KS', name: '셀트리온', aliases: ['셀트리온', 'celltrion', '068270'] },
  { symbol: '207940.KS', name: '삼성바이오로직스', aliases: ['삼성바이오로직스', '삼바', 'samsung biologics', '207940'] },
  { symbol: '066570.KS', name: 'LG전자', aliases: ['lg전자', 'lg electronics', '066570'] },
  { symbol: '096770.KQ', name: 'SK이노베이션머티리얼즈', aliases: ['sk이노베이션머티리얼즈', '096770'] },
  { symbol: '323410.KS', name: '카카오뱅크', aliases: ['카카오뱅크', 'kakao bank', '323410'] },
  { symbol: '373220.KS', name: 'LG에너지솔루션', aliases: ['lg에너지솔루션', 'lg energy solution', '373220'] },
  { symbol: '034020.KS', name: '두산에너빌리티', aliases: ['두산에너빌리티', 'doosan', '034020'] },
  { symbol: '018260.KS', name: '삼성에스디에스', aliases: ['삼성sds', '삼성에스디에스', '018260'] },
  { symbol: '032830.KS', name: '삼성생명', aliases: ['삼성생명', '032830'] },
  { symbol: '086790.KS', name: '하나금융지주', aliases: ['하나금융', '086790'] },
  { symbol: '105560.KS', name: 'KB금융', aliases: ['kb금융', 'kb financial', '105560'] },
];

const state = {
  selectedSymbol: null,
  selectedName: null,
  selectedMarket: null,
  selectedCurrency: null,
  suggestions: [],
  activeSuggestionIndex: -1,
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  $('date-input').value = formatInputDate(today);
  $('date-input').max = formatInputDate(today);

  $('company-input').addEventListener('input', debounce(handleCompanyInput, 250));
  $('company-input').addEventListener('keydown', handleSuggestionKeydown);
  $('date-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
  $('search-btn').addEventListener('click', runSearch);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.autocomplete')) hideSuggestions();
  });
});

async function handleCompanyInput() {
  const query = $('company-input').value.trim();
  resetSelectedSecurity();

  if (!query) {
    hideSuggestions();
    return;
  }

  try {
    const ranked = await getRankedSearchResults(query, 8);
    state.suggestions = ranked;
    renderSuggestions();
  } catch {
    hideSuggestions();
  }
}

async function getRankedSearchResults(query, limit = 8) {
  const normalized = normalizeQuery(query);
  const directPreset = findPresetMatch(normalized);
  const queryVariants = buildSearchVariants(query);
  const requests = [];

  queryVariants.forEach((variant) => {
    requests.push(fetchJSON(`/api/search?q=${encodeURIComponent(variant)}&lang=ko&region=KR`));
    requests.push(fetchJSON(`/api/search?q=${encodeURIComponent(variant)}&lang=en&region=US`));
  });

  const results = await Promise.allSettled(requests);
  const unique = new Map();

  if (directPreset) {
    unique.set(directPreset.symbol, {
      symbol: directPreset.symbol,
      longname: directPreset.name,
      shortname: directPreset.name,
      exchDisp: directPreset.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
      exchange: directPreset.symbol.endsWith('.KQ') ? 'KSC' : 'KSC',
      quoteType: 'EQUITY',
      region: 'KR',
      preset: true,
    });
  }

  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;

    (result.value.quotes || []).forEach((item) => {
      if (!item?.symbol) return;
      if (['INDEX', 'NEWS', 'MUTUALFUND', 'FUTURE'].includes(item.quoteType)) return;
      if (!unique.has(item.symbol)) unique.set(item.symbol, item);
    });
  });

  return Array.from(unique.values())
    .map((item) => ({ ...item, score: scoreQuote(item, normalized) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function renderSuggestions() {
  const list = $('suggestion-list');
  list.innerHTML = '';
  state.activeSuggestionIndex = -1;

  if (!state.suggestions.length) {
    hideSuggestions();
    return;
  }

  state.suggestions.forEach((item, index) => {
    const name = getDisplayName(item);
    const market = getExchangeLabel(item);
    const meta = [market, item.typeDisp || item.quoteType].filter(Boolean).join(' · ');

    const li = document.createElement('li');
    li.dataset.index = String(index);
    li.innerHTML = `
      <div class="sug-main">
        <span class="sug-name">${escapeHtml(name)}</span>
        <span class="sug-meta">${escapeHtml(meta || '검색 결과')}</span>
      </div>
      <span class="sug-symbol">${escapeHtml(item.symbol)}</span>
    `;
    li.addEventListener('click', () => selectSuggestion(index));
    list.appendChild(li);
  });

  list.classList.remove('hidden');
}

function handleSuggestionKeydown(event) {
  const items = $('suggestion-list').querySelectorAll('li');

  if (!items.length) {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.activeSuggestionIndex = Math.min(state.activeSuggestionIndex + 1, items.length - 1);
    highlightSuggestions(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.activeSuggestionIndex = Math.max(state.activeSuggestionIndex - 1, 0);
    highlightSuggestions(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (state.activeSuggestionIndex >= 0) selectSuggestion(state.activeSuggestionIndex);
    else runSearch();
  } else if (event.key === 'Escape') {
    hideSuggestions();
  }
}

function highlightSuggestions(items) {
  items.forEach((item, index) => {
    item.classList.toggle('active', index === state.activeSuggestionIndex);
  });
}

function selectSuggestion(index) {
  const item = state.suggestions[index];
  if (!item) return;

  state.selectedSymbol = item.symbol;
  state.selectedName = getDisplayName(item);
  state.selectedMarket = getExchangeLabel(item);
  state.selectedCurrency = item.currency || guessCurrencyFromSymbol(item.symbol);
  $('company-input').value = state.selectedName;
  hideSuggestions();
}

function hideSuggestions() {
  $('suggestion-list').classList.add('hidden');
  state.activeSuggestionIndex = -1;
}

async function runSearch() {
  const companyQuery = $('company-input').value.trim();
  const dateValue = $('date-input').value;

  if (!companyQuery) return showError('회사명 또는 티커를 입력해 주세요.');
  if (!dateValue) return showError('기준 날짜를 선택해 주세요.');

  clearError();
  toggleLoading(true);
  $('results').classList.add('hidden');

  try {
    if (!state.selectedSymbol) {
      const candidate = await resolveSymbol(companyQuery);
      state.selectedSymbol = candidate.symbol;
      state.selectedName = candidate.name;
      state.selectedMarket = candidate.market || getExchangeLabel(candidate.raw || {});
      state.selectedCurrency = candidate.currency || guessCurrencyFromSymbol(candidate.symbol);
    }

    const centerDate = new Date(`${dateValue}T00:00:00`);
    const previousCenter = shiftOneYearBack(centerDate);

    const [currentWindow, previousWindow] = await Promise.all([
      fetchWindow(state.selectedSymbol, centerDate, 7),
      fetchWindow(state.selectedSymbol, previousCenter, 7),
    ]);

    if (!state.selectedCurrency) {
      state.selectedCurrency = currentWindow.meta.currency || previousWindow.meta.currency || guessCurrencyFromSymbol(state.selectedSymbol);
    }
    if (!state.selectedMarket) {
      state.selectedMarket = currentWindow.meta.exchangeName || currentWindow.meta.fullExchangeName || currentWindow.meta.exchangeTimezoneName || guessMarketFromSymbol(state.selectedSymbol);
    }

    renderResult(centerDate, previousCenter, currentWindow, previousWindow);
  } catch (error) {
    showError(error.message || '데이터를 가져오지 못했습니다.');
  } finally {
    toggleLoading(false);
  }
}

async function resolveSymbol(query) {
  const normalized = normalizeQuery(query);
  const preset = findPresetMatch(normalized);
  if (preset) {
    return {
      symbol: preset.symbol,
      name: preset.name,
      market: preset.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
      currency: guessCurrencyFromSymbol(preset.symbol),
    };
  }

  const ranked = await getRankedSearchResults(query, 12);
  const top = ranked[0];

  if (!top) {
    throw new Error('해당 회사명을 찾지 못했습니다. 회사명, 6자리 종목코드, 또는 티커 심볼로 다시 시도해 주세요.');
  }

  return {
    symbol: top.symbol,
    name: getDisplayName(top),
    market: getExchangeLabel(top),
    currency: top.currency || guessCurrencyFromSymbol(top.symbol),
    raw: top,
  };
}

async function fetchWindow(symbol, centerDate, radius) {
  const start = new Date(centerDate);
  const end = new Date(centerDate);
  start.setDate(start.getDate() - radius);
  end.setDate(end.getDate() + radius);

  const period1 = Math.floor(start.getTime() / 1000);
  const period2 = Math.floor(end.getTime() / 1000) + 86400;

  const payload = await fetchJSON(`/api/chart?symbol=${encodeURIComponent(symbol)}&period1=${period1}&period2=${period2}`);
  const chart = payload?.chart?.result?.[0];
  const error = payload?.chart?.error;

  if (error) throw new Error(error.description || '차트 데이터를 불러오지 못했습니다.');
  if (!chart) throw new Error('선택한 기간에 대한 주가 데이터가 없습니다.');

  const timestamps = chart.timestamp || [];
  const quote = chart.indicators?.quote?.[0] || {};
  const adjclose = chart.indicators?.adjclose?.[0]?.adjclose || [];

  const points = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000),
    label: formatDisplayDate(new Date(timestamp * 1000)),
    close: quote.close?.[index],
    open: quote.open?.[index],
    high: quote.high?.[index],
    low: quote.low?.[index],
    volume: quote.volume?.[index] || 0,
    adjclose: adjclose[index] ?? quote.close?.[index],
  })).filter((point) => Number.isFinite(point.close));

  if (!points.length) throw new Error('거래일 데이터가 비어 있습니다. 다른 날짜를 선택해 주세요.');

  return {
    startDate: points[0].date,
    endDate: points[points.length - 1].date,
    points,
    summary: summarizePoints(points),
    meta: chart.meta || {},
  };
}

function summarizePoints(points) {
  const first = points[0];
  const last = points[points.length - 1];
  const closes = points.map((point) => point.close);
  const highs = points.map((point) => point.high).filter(Number.isFinite);
  const lows = points.map((point) => point.low).filter(Number.isFinite);
  const totalVolume = points.reduce((sum, point) => sum + (point.volume || 0), 0);
  const change = last.close - first.close;
  const changeRate = first.close ? (change / first.close) * 100 : 0;

  return {
    firstClose: first.close,
    lastClose: last.close,
    high: Math.max(...(highs.length ? highs : closes)),
    low: Math.min(...(lows.length ? lows : closes)),
    totalVolume,
    change,
    changeRate,
  };
}

function renderResult(centerDate, previousCenter, currentWindow, previousWindow) {
  const currency = state.selectedCurrency || currentWindow.meta.currency || previousWindow.meta.currency || 'USD';
  const market = state.selectedMarket || currentWindow.meta.fullExchangeName || currentWindow.meta.exchangeName || guessMarketFromSymbol(state.selectedSymbol);

  $('results').classList.remove('hidden');
  $('result-title').textContent = `${state.selectedName} 비교 결과`;
  $('ticker-pill').textContent = `${state.selectedName} · ${state.selectedSymbol}`;

  $('overview-exchange').textContent = compactMarketLabel(market);
  $('overview-market-name').textContent = state.selectedSymbol;
  $('overview-currency').textContent = currency;
  $('overview-price-hint').textContent = `가격 표시는 ${currency} 기준입니다.`;
  $('overview-reference-date').textContent = formatInputDate(centerDate);
  $('overview-previous-date').textContent = `비교 구간: ${formatInputDate(previousCenter)}`;
  $('overview-session-count').textContent = `${currentWindow.points.length} / ${previousWindow.points.length}`;

  fillSummaryCard('current', currentWindow, currency);
  fillSummaryCard('previous', previousWindow, currency);

  $('chart-a-title').textContent = `${formatInputDate(centerDate)} 기준 전후 7일`;
  $('chart-b-title').textContent = `${formatInputDate(previousCenter)} 기준 전후 7일`;

  $('chart-a-stats').innerHTML = statsMarkup(currentWindow.summary, currency);
  $('chart-b-stats').innerHTML = statsMarkup(previousWindow.summary, currency);
  $('insight-list').innerHTML = buildInsightMarkup(currentWindow.summary, previousWindow.summary, currency);

  drawSingleSeriesChart('chart-a', currentWindow.points, {
    lineColor: '#2668f2',
    areaClass: 'chart-area--blue',
    pointColor: '#2668f2',
    yFormatter: (value) => shortPriceLabel(value, currency),
  });

  drawSingleSeriesChart('chart-b', previousWindow.points, {
    lineColor: '#f2a427',
    areaClass: 'chart-area--gold',
    pointColor: '#f2a427',
    yFormatter: (value) => shortPriceLabel(value, currency),
  });

  drawOverlayChart('chart-overlay', [
    { color: '#2668f2', values: normalizeSeries(currentWindow.points) },
    { color: '#f2a427', values: normalizeSeries(previousWindow.points) },
  ]);
}

function fillSummaryCard(prefix, windowData, currency) {
  const summary = windowData.summary;
  $(`${prefix}-range-label`).textContent = `${formatInputDate(windowData.startDate)} ~ ${formatInputDate(windowData.endDate)}`;
  $(`${prefix}-start-price`).textContent = formatPrice(summary.firstClose, currency);
  $(`${prefix}-end-price`).textContent = formatPrice(summary.lastClose, currency);

  const delta = $(`${prefix}-change`);
  const rateSign = summary.changeRate > 0 ? '+' : '';
  const amountSign = summary.change > 0 ? '+' : '';
  delta.textContent = `${rateSign}${summary.changeRate.toFixed(2)}% (${amountSign}${formatRawNumber(summary.change)})`;
  delta.className = `delta-text ${deltaClass(summary.changeRate)}`;
}

function buildInsightMarkup(currentSummary, previousSummary, currency) {
  const currentAbs = Math.abs(currentSummary.changeRate);
  const previousAbs = Math.abs(previousSummary.changeRate);
  const strongerWindow = currentAbs > previousAbs
    ? '선택 날짜 구간'
    : previousAbs > currentAbs
      ? '1년 전 구간'
      : '두 구간 유사';

  const directionCompare = describeDirectionCompare(currentSummary.changeRate, previousSummary.changeRate);
  const spreadGap = Math.abs((currentSummary.high - currentSummary.low) - (previousSummary.high - previousSummary.low));

  const items = [
    { label: '변동폭이 더 큰 구간', value: strongerWindow },
    { label: '방향 비교', value: directionCompare },
    { label: '고저 범위 차이', value: formatPrice(spreadGap, currency) },
  ];

  return items.map((item) => `
    <div class="insight-item">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join('');
}

function describeDirectionCompare(currentRate, previousRate) {
  const currentDirection = currentRate > 0 ? '상승' : currentRate < 0 ? '하락' : '보합';
  const previousDirection = previousRate > 0 ? '상승' : previousRate < 0 ? '하락' : '보합';
  return `${currentDirection} / ${previousDirection}`;
}

function statsMarkup(summary, currency) {
  return [
    { label: '고가', value: formatPrice(summary.high, currency) },
    { label: '저가', value: formatPrice(summary.low, currency) },
    { label: '거래량', value: formatVolume(summary.totalVolume) },
  ].map((item) => `<div class="stat-chip">${item.label} <strong>${item.value}</strong></div>`).join('');
}

function drawSingleSeriesChart(svgId, points, options) {
  renderSvgChart(svgId, {
    width: 640,
    height: 300,
    margin: { top: 24, right: 20, bottom: 36, left: 64 },
    labels: points.map((point) => point.label),
    series: [{
      values: points.map((point) => point.close),
      color: options.lineColor,
      areaClass: options.areaClass,
      pointColor: options.pointColor,
    }],
    yFormatter: options.yFormatter,
    showArea: true,
  });
}

function drawOverlayChart(svgId, seriesList) {
  const width = 640;
  const height = 320;
  const margin = { top: 28, right: 20, bottom: 36, left: 56 };
  const labels = Array.from({ length: Math.max(...seriesList.map((series) => series.values.length)) }, (_, index) => `D${index + 1}`);

  renderSvgChart(svgId, {
    width,
    height,
    margin,
    labels,
    series: seriesList.map((series) => ({
      values: series.values,
      color: series.color,
      pointColor: series.color,
      areaClass: null,
    })),
    yFormatter: (value) => `${value.toFixed(1)}`,
    showArea: false,
  });
}

function renderSvgChart(svgId, { width, height, margin, labels, series, yFormatter, showArea }) {
  const svg = $(svgId);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const allValues = series.flatMap((entry) => entry.values).filter(Number.isFinite);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue || 1) * 0.12;
  const domainMin = minValue - padding;
  const domainMax = maxValue + padding;

  const x = (index, total) => margin.left + (total <= 1 ? innerWidth / 2 : (index / (total - 1)) * innerWidth);
  const y = (value) => margin.top + ((domainMax - value) / (domainMax - domainMin || 1)) * innerHeight;

  const gridLines = 5;
  let markup = '';

  for (let i = 0; i < gridLines; i += 1) {
    const ratio = i / (gridLines - 1);
    const py = margin.top + ratio * innerHeight;
    const value = domainMax - ratio * (domainMax - domainMin);
    markup += `<line class="grid-line" x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}"></line>`;
    markup += `<text class="axis-label" x="${margin.left - 10}" y="${py + 4}" text-anchor="end">${escapeHtml(yFormatter(value))}</text>`;
  }

  markup += `<line class="axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>`;
  markup += `<line class="axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>`;

  const tickIndexes = buildTickIndexes(labels.length, 5);
  tickIndexes.forEach((index) => {
    const px = x(index, labels.length);
    markup += `<text class="axis-label" x="${px}" y="${height - 12}" text-anchor="middle">${escapeHtml(labels[index] || '')}</text>`;
  });

  series.forEach((entry) => {
    const path = buildPath(entry.values, x, y);
    if (showArea && entry.areaClass) {
      const area = buildAreaPath(entry.values, x, y, height - margin.bottom);
      markup += `<path class="${entry.areaClass}" d="${area}"></path>`;
    }
    markup += `<path class="chart-path" d="${path}" stroke="${entry.color}"></path>`;

    entry.values.forEach((value, index) => {
      const px = x(index, entry.values.length);
      const py = y(value);
      markup += `<circle class="chart-point" cx="${px}" cy="${py}" r="4" fill="${entry.pointColor}"></circle>`;
    });
  });

  svg.innerHTML = markup;
}

function buildPath(values, xAccessor, yAccessor) {
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAccessor(index, values.length)} ${yAccessor(value)}`).join(' ');
}

function buildAreaPath(values, xAccessor, yAccessor, baseline) {
  const linePath = buildPath(values, xAccessor, yAccessor);
  const lastX = xAccessor(values.length - 1, values.length);
  const firstX = xAccessor(0, values.length);
  return `${linePath} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
}

function buildTickIndexes(length, desiredCount) {
  if (length <= desiredCount) return Array.from({ length }, (_, index) => index);
  const indexes = new Set([0, length - 1]);
  const step = (length - 1) / (desiredCount - 1);
  for (let i = 1; i < desiredCount - 1; i += 1) {
    indexes.add(Math.round(step * i));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

function normalizeSeries(points) {
  const base = points[0]?.close || 1;
  return points.map((point) => (point.close / base) * 100);
}

function buildSearchVariants(query) {
  const trimmed = query.trim();
  const normalized = normalizeQuery(trimmed);
  const variants = new Set([trimmed]);

  if (/^\d{6}$/.test(trimmed)) {
    variants.add(`${trimmed}.KS`);
    variants.add(`${trimmed}.KQ`);
  }

  const preset = findPresetMatch(normalized);
  if (preset) {
    variants.add(preset.symbol);
    variants.add(preset.name);
  }

  return Array.from(variants);
}

function findPresetMatch(normalizedQuery) {
  return KOREAN_STOCK_PRESETS.find((item) => item.aliases.some((alias) => normalizeQuery(alias) === normalizedQuery));
}

function scoreQuote(item, normalizedQuery) {
  const name = normalizeQuery(getDisplayName(item));
  const symbol = normalizeQuery(item.symbol || '');
  const exchange = normalizeQuery(getExchangeLabel(item));
  let score = 0;

  if (symbol === normalizedQuery) score += 250;
  if (name === normalizedQuery) score += 220;
  if (symbol.startsWith(normalizedQuery)) score += 140;
  if (name.startsWith(normalizedQuery)) score += 130;
  if (symbol.includes(normalizedQuery)) score += 60;
  if (name.includes(normalizedQuery)) score += 70;
  if (exchange.includes('kospi') || exchange.includes('kosdaq')) score += 24;
  if ((item.symbol || '').endsWith('.KS')) score += 22;
  if ((item.symbol || '').endsWith('.KQ')) score += 18;
  if (item.preset) score += 45;
  if ((item.quoteType || '').toUpperCase() === 'EQUITY') score += 16;
  if ((item.exchange || '').toUpperCase().includes('NMS')) score += 8;

  return score;
}

function getDisplayName(item) {
  return item.longname || item.shortname || item.name || item.symbol;
}

function getExchangeLabel(item) {
  return item.exchDisp || item.exchangeDisp || item.exchange || guessMarketFromSymbol(item.symbol || '');
}

function guessMarketFromSymbol(symbol) {
  if (symbol.endsWith('.KS')) return 'KOSPI';
  if (symbol.endsWith('.KQ')) return 'KOSDAQ';
  return 'GLOBAL';
}

function guessCurrencyFromSymbol(symbol) {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return 'KRW';
  return 'USD';
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`요청 실패: HTTP ${response.status}`);
  }
  return response.json();
}

function toggleLoading(isLoading) {
  $('loading').classList.toggle('hidden', !isLoading);
  $('search-btn').disabled = isLoading;
}

function showError(message) {
  $('error-msg').textContent = message;
  $('error-box').classList.remove('hidden');
}

function clearError() {
  $('error-msg').textContent = '';
  $('error-box').classList.add('hidden');
}

function resetSelectedSecurity() {
  state.selectedSymbol = null;
  state.selectedName = null;
  state.selectedMarket = null;
  state.selectedCurrency = null;
}

function deltaClass(value) {
  if (value > 0) return 'delta-up';
  if (value < 0) return 'delta-down';
  return 'delta-flat';
}

function normalizeQuery(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function shiftOneYearBack(date) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - 1);
  return result;
}

function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(value);
}

function shortPriceLabel(value, currency = 'USD') {
  if (currency === 'KRW') {
    return `${Math.round(value).toLocaleString('ko-KR')}`;
  }
  return `${Math.round(value).toLocaleString('en-US')}`;
}

function formatRawNumber(value) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compactMarketLabel(value) {
  const text = String(value || '').trim();
  return text.length > 18 ? text.slice(0, 18) : text || '-';
}

function formatVolume(value) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
