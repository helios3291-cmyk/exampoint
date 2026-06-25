const TIER_ORDER = ["상", "중", "하"];
const TIER_KEYS = { 상: "high", 중: "mid", 하: "low" };
const WITHIN_INTERVAL = 0.1;

const VARIANT_PROFILES = [
  { id: "fine", label: "안 A · 세밀형", groupOffset: 1 },
  { id: "balanced", label: "안 B · 균형형", groupOffset: 0 },
  { id: "simple", label: "안 C · 단순형", groupOffset: -1 },
];

const state = {
  variants: [],
  selectedVariantId: null,
  selectedQuestions: [],
  betweenGap: 0.3,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function readInputs() {
  const anchor2Raw = document.getElementById("anchor2").value.trim();
  return {
    total: parseInt(document.getElementById("total").value, 10),
    counts: {
      상: parseInt(document.getElementById("count-high").value, 10) || 0,
      중: parseInt(document.getElementById("count-mid").value, 10) || 0,
      하: parseInt(document.getElementById("count-low").value, 10) || 0,
    },
    anchor1: parseFloat(document.getElementById("anchor1").value),
    anchor2: anchor2Raw === "" ? null : parseFloat(anchor2Raw),
    groupCounts: {
      상: parseInt(document.getElementById("group-high").value, 10) || 3,
      중: parseInt(document.getElementById("group-mid").value, 10) || 4,
      하: parseInt(document.getElementById("group-low").value, 10) || 3,
    },
    betweenGap: parseFloat(document.getElementById("between-gap").value),
  };
}

function resolveGroupCount(baseCount, questionCount, offset) {
  if (questionCount <= 0) return 0;
  if (questionCount === 1) return 1;
  let n = baseCount + offset;
  if (offset < 0) n = Math.max(2, n);
  n = Math.max(1, n);
  return Math.min(n, questionCount);
}

function applyProfileGroupCounts(input, profile) {
  const result = {};
  for (const tier of TIER_ORDER) {
    result[tier] = resolveGroupCount(input.groupCounts[tier], input.counts[tier], profile.groupOffset);
  }
  return result;
}

function updateSumStatus() {
  const { total, counts } = readInputs();
  const sum = counts.상 + counts.중 + counts.하;
  const el = document.getElementById("sum-status");
  if (sum === total) {
    el.textContent = `자동 합계: ${sum} / ${total}`;
    el.className = "sum-status ok";
  } else {
    el.textContent = `자동 합계: ${sum} / ${total} — 불일치!`;
    el.className = "sum-status err";
  }
}

function generateTierGroups(maxPoint, questionCount, groupCount) {
  if (questionCount <= 0) return [];

  const numGroups = Math.min(groupCount, questionCount);
  const base = Math.floor(questionCount / numGroups);
  const extra = questionCount % numGroups;
  const groups = [];

  for (let i = 0; i < numGroups; i++) {
    const point = round1(maxPoint - i * WITHIN_INTERVAL);
    const assign = base + (i >= numGroups - extra ? 1 : 0);
    groups.push({ point, count: assign });
  }

  return groups;
}

function expandGroupsToQuestions(groups, tier) {
  const questions = [];
  for (const { point, count } of groups) {
    for (let i = 0; i < count; i++) {
      questions.push({ tier, point });
    }
  }
  return questions;
}

function tierMaxFromAbove(minAbove, betweenGap) {
  return round1(minAbove - betweenGap);
}

function minPointOfGroups(groups) {
  if (!groups.length) return Infinity;
  return groups[groups.length - 1].point;
}

function buildInitialStructure(input, groupCounts, betweenGap) {
  const { counts, anchor1, anchor2 } = input;
  const tierGroups = [];

  if (counts.상 > 0) {
    tierGroups.push({
      tier: "상",
      groups: generateTierGroups(anchor1, counts.상, groupCounts.상),
    });
  }

  if (counts.중 > 0) {
    let maxM;
    if (counts.상 > 0) {
      const minH = minPointOfGroups(tierGroups.find((t) => t.tier === "상").groups);
      maxM = tierMaxFromAbove(minH, betweenGap);
    } else {
      maxM = anchor1;
    }
    tierGroups.push({
      tier: "중",
      groups: generateTierGroups(maxM, counts.중, groupCounts.중),
    });
  }

  if (counts.하 > 0) {
    let maxL;
    if (counts.중 > 0) {
      const minM = minPointOfGroups(tierGroups.find((t) => t.tier === "중").groups);
      maxL = tierMaxFromAbove(minM, betweenGap);
    } else if (counts.상 > 0) {
      const minH = minPointOfGroups(tierGroups.find((t) => t.tier === "상").groups);
      maxL = tierMaxFromAbove(minH, betweenGap);
    } else {
      maxL = anchor1;
    }
    tierGroups.push({
      tier: "하",
      groups: generateTierGroups(maxL, counts.하, groupCounts.하),
    });
  }

  let questions = [];
  for (const { tier, groups } of tierGroups) {
    questions.push(...expandGroupsToQuestions(groups, tier));
  }

  if (anchor2 !== null && counts.하 > 0) {
    const lowPoints = questions.filter((q) => q.tier === "하").map((q) => q.point);
    const currentMinL = Math.min(...lowPoints);
    const shift = round1(anchor2 - currentMinL);
    questions = questions.map((q) => ({ ...q, point: round1(q.point + shift) }));
  }

  return questions;
}

function checkOrdering(questions, betweenGap) {
  const byTier = { 상: [], 중: [], 하: [] };
  for (const q of questions) byTier[q.tier].push(q.point);

  if (byTier.상.length && byTier.중.length) {
    if (Math.min(...byTier.상) <= Math.max(...byTier.중)) return false;
    if (round1(Math.min(...byTier.상) - Math.max(...byTier.중)) < betweenGap - 0.01) return false;
  }
  if (byTier.중.length && byTier.하.length) {
    if (Math.min(...byTier.중) <= Math.max(...byTier.하)) return false;
    if (round1(Math.min(...byTier.중) - Math.max(...byTier.하)) < betweenGap - 0.01) return false;
  }
  if (byTier.상.length && byTier.하.length && !byTier.중.length) {
    if (Math.min(...byTier.상) <= Math.max(...byTier.하)) return false;
    if (round1(Math.min(...byTier.상) - Math.max(...byTier.하)) < betweenGap - 0.01) return false;
  }

  return questions.every((q) => q.point > 0);
}

function adjustTo100(questions) {
  const n = questions.length;
  let pts = questions.map((q) => q.point);
  let sum = round1(pts.reduce((a, b) => a + b, 0));
  let delta = round1(100 - sum);

  if (Math.abs(delta) < 0.05) {
    return questions.map((q, i) => ({ ...q, point: pts[i] }));
  }

  const perQ = delta / n;
  pts = pts.map((p) => round1(p + perQ));
  let remainder = round1(100 - round1(pts.reduce((a, b) => a + b, 0)));

  let guard = 0;
  while (Math.abs(remainder) >= 0.05 && guard < n * 200) {
    const idx = remainder > 0 ? guard % n : n - 1 - (guard % n);
    const step = remainder > 0 ? 0.1 : -0.1;
    const next = round1(pts[idx] + step);
    if (next > 0) {
      pts[idx] = next;
      remainder = round1(remainder - step);
    }
    guard++;
  }

  return questions.map((q, i) => ({ ...q, point: pts[i] }));
}

function validateInput(input, groupCounts, betweenGap) {
  const { total, counts, anchor1, anchor2 } = input;
  const sum = counts.상 + counts.중 + counts.하;

  if (!Number.isFinite(total) || total < 1) return "총 문항 수를 1 이상으로 입력해 주세요.";
  if (sum !== total) return `난이도별 문항 수 합(${sum})이 총 문항 수(${total})와 일치하지 않습니다.`;
  if (sum === 0) return "문항 수가 0입니다.";
  if (!Number.isFinite(anchor1) || anchor1 <= 0) return "배점 예시 1을 0보다 크게 입력해 주세요.";
  if (anchor2 !== null && (!Number.isFinite(anchor2) || anchor2 <= 0)) return "배점 예시 2가 올바르지 않습니다.";
  if (anchor2 !== null && anchor2 >= anchor1) return "배점 예시 2는 예시 1보다 작아야 합니다.";
  if (!Number.isFinite(betweenGap) || betweenGap <= 0) return "난이도 간 최소 간격을 0보다 크게 입력해 주세요.";

  for (const tier of TIER_ORDER) {
    if (counts[tier] === 0) continue;
    const gc = groupCounts[tier];
    if (!Number.isFinite(gc) || gc < 1) return `${tier} 난이도 배점 종류 수는 1 이상이어야 합니다.`;
    if (gc > counts[tier]) return `${tier} 난이도 배점 종류 수(${gc})가 문항 수(${counts[tier]})보다 많습니다.`;
  }

  const minNeeded =
    (counts.상 > 0 ? (groupCounts.상 - 1) * WITHIN_INTERVAL : 0) +
    (counts.중 > 0 ? (groupCounts.중 - 1) * WITHIN_INTERVAL : 0) +
    (counts.하 > 0 ? (groupCounts.하 - 1) * WITHIN_INTERVAL : 0);

  const gaps =
    (counts.상 > 0 && counts.중 > 0 ? betweenGap : 0) +
    (counts.중 > 0 && counts.하 > 0 ? betweenGap : 0) +
    (counts.상 > 0 && counts.하 > 0 && counts.중 === 0 ? betweenGap : 0);

  if (anchor1 - minNeeded - gaps < 0.5) {
    return "문항 수·배점 종류 대비 배점 예시가 너무 낮습니다. 예시 배점을 높이거나 배점 종류 수를 줄여 주세요.";
  }

  return null;
}

function formatGroupCountsMeta(groupCounts, counts) {
  return TIER_ORDER.filter((t) => counts[t] > 0)
    .map((t) => `${t} ${groupCounts[t]}종`)
    .join(" / ");
}

function recommendVariant(input, profile) {
  const groupCounts = applyProfileGroupCounts(input, profile);
  const betweenGap = input.betweenGap;

  const err = validateInput(input, groupCounts, betweenGap);
  if (err) return { ...profile, error: err, questions: null, groupCounts };

  let questions = buildInitialStructure(input, groupCounts, betweenGap);

  if (questions.some((q) => q.point <= 0)) {
    return { ...profile, error: "계산 결과에 0 이하 배점이 생깁니다.", questions: null, groupCounts, betweenGap };
  }

  questions = adjustTo100(questions);

  if (!checkOrdering(questions, betweenGap)) {
    return { ...profile, error: "상>중>하 순서 또는 난이도 간 간격을 유지할 수 없습니다.", questions: null, groupCounts, betweenGap };
  }

  const totalSum = round1(questions.reduce((a, q) => a + q.point, 0));
  if (Math.abs(totalSum - 100) >= 0.05) {
    return { ...profile, error: "100점 맞춤에 실패했습니다.", questions: null, groupCounts, betweenGap };
  }

  return {
    ...profile,
    error: null,
    questions,
    groupCounts,
    betweenGap,
    stats: tierStats(questions),
    groupSummary: summarizeByGroups(questions),
  };
}

function recommendAll(input) {
  return VARIANT_PROFILES.map((profile) => recommendVariant(input, profile));
}

function tierStats(questions) {
  const stats = {};
  for (const tier of TIER_ORDER) {
    const pts = questions.filter((q) => q.tier === tier).map((q) => q.point);
    if (!pts.length) continue;
    stats[tier] = {
      count: pts.length,
      min: Math.min(...pts),
      max: Math.max(...pts),
      subtotal: round1(pts.reduce((a, b) => a + b, 0)),
    };
  }
  return stats;
}

function summarizeByGroups(questions) {
  const result = [];

  for (const tier of TIER_ORDER) {
    const tierQs = questions.filter((q) => q.tier === tier);
    if (!tierQs.length) continue;

    const countMap = new Map();
    for (const q of tierQs) {
      countMap.set(q.point, (countMap.get(q.point) || 0) + 1);
    }

    const groups = [...countMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([point, count]) => ({ point, count }));

    const subtotal = round1(tierQs.reduce((a, q) => a + q.point, 0));
    const groupText = groups.map((g) => `${g.point.toFixed(1)}점 ${g.count}문항`).join(", ");

    result.push({
      tier,
      count: tierQs.length,
      subtotal,
      groupText,
      groups,
    });
  }

  return result;
}

function renderGroupSummaryHtml(groupSummary) {
  return groupSummary
    .map(
      (g) => `
      <div class="group-tier group-tier-${TIER_KEYS[g.tier]}">
        <div class="group-tier-head">
          <strong>${g.tier}</strong> ${g.count}문항 · 소계 ${g.subtotal.toFixed(1)}점
        </div>
        <div class="group-tier-detail">${g.groupText}</div>
      </div>`
    )
    .join("");
}

function renderProposals(variants) {
  const section = document.getElementById("result-section");
  const editorSection = document.getElementById("editor-section");
  section.hidden = false;
  editorSection.hidden = true;

  const input = readInputs();
  const grid = document.getElementById("proposals-grid");
  grid.innerHTML = variants
    .map((v) => {
      if (v.error) {
        return `
        <article class="proposal-card proposal-card-fail" data-variant="${v.id}">
          <h3>${v.label}</h3>
          <p class="proposal-error">${v.error}</p>
          <button type="button" class="select-btn" disabled>생성 불가</button>
        </article>`;
      }

      const totalSum = round1(v.questions.reduce((a, q) => a + q.point, 0));
      const badges = TIER_ORDER.filter((t) => v.stats[t])
        .map(
          (t) =>
            `<span class="tier-badge ${TIER_KEYS[t]}">${t} ${v.stats[t].count}문항 · ${v.stats[t].max}~${v.stats[t].min}점 · 소계 ${v.stats[t].subtotal}점</span>`
        )
        .join("");

      return `
      <article class="proposal-card" data-variant="${v.id}">
        <h3>${v.label}</h3>
        <div class="proposal-summary">
          <div class="total">총점: ${totalSum.toFixed(1)}점</div>
          <div class="meta">난이도 간 ${v.betweenGap}점 · ${formatGroupCountsMeta(v.groupCounts, input.counts)}</div>
          <div class="tier-summary">${badges}</div>
        </div>
        <div class="proposal-groups">${renderGroupSummaryHtml(v.groupSummary)}</div>
        <button type="button" class="select-btn" data-variant="${v.id}">이 안 선택하기</button>
      </article>`;
    })
    .join("");

  grid.querySelectorAll(".select-btn:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => selectProposal(btn.dataset.variant));
  });
}

function selectProposal(variantId) {
  const variant = state.variants.find((v) => v.id === variantId);
  if (!variant || variant.error) return;

  state.selectedVariantId = variantId;
  state.selectedQuestions = variant.questions.map((q) => ({ ...q }));
  state.betweenGap = variant.betweenGap;

  document.getElementById("result-section").hidden = true;
  document.getElementById("editor-section").hidden = false;
  document.getElementById("selected-label").textContent = variant.label;

  renderEditor();
}

function hasMoreThanOneDecimal(value) {
  const s = String(value);
  const dot = s.indexOf(".");
  if (dot === -1) return false;
  return s.length - dot - 1 > 1;
}

function validateQuestions(questions, betweenGap) {
  const issues = [];

  for (let i = 0; i < questions.length; i++) {
    const p = questions[i].point;
    if (!Number.isFinite(p) || p <= 0) {
      issues.push(`${i + 1}번 문항 배점이 0 이하이거나 올바르지 않습니다.`);
    }
    if (hasMoreThanOneDecimal(p)) {
      issues.push(`${i + 1}번 문항: 소수 둘째 자리까지 입력할 수 없습니다.`);
    }
  }

  const sum = round1(questions.reduce((a, q) => a + (Number.isFinite(q.point) ? q.point : 0), 0));
  if (Math.abs(sum - 100) >= 0.05) {
    const diff = round1(100 - sum);
    const dir = diff > 0 ? `${diff.toFixed(1)}점 더 필요` : `${Math.abs(diff).toFixed(1)}점 줄여야 함`;
    issues.push(`총점 ${sum.toFixed(1)}점 — 100.0점이 되도록 ${dir}`);
  }

  const byTier = { 상: [], 중: [], 하: [] };
  questions.forEach((q, i) => {
    if (Number.isFinite(q.point) && q.point > 0) byTier[q.tier].push({ point: q.point, num: i + 1 });
  });

  if (byTier.상.length && byTier.중.length) {
    const minH = Math.min(...byTier.상.map((x) => x.point));
    const maxM = Math.max(...byTier.중.map((x) => x.point));
    if (minH <= maxM) {
      issues.push("중 난이도 최고 배점이 상 난이도 최저 배점 이상입니다. (상 > 중 필요)");
    } else if (round1(minH - maxM) < betweenGap - 0.01) {
      issues.push(`상·중 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
    }
  }

  if (byTier.중.length && byTier.하.length) {
    const minM = Math.min(...byTier.중.map((x) => x.point));
    const maxL = Math.max(...byTier.하.map((x) => x.point));
    if (minM <= maxL) {
      issues.push("하 난이도 최고 배점이 중 난이도 최저 배점 이상입니다. (중 > 하 필요)");
    } else if (round1(minM - maxL) < betweenGap - 0.01) {
      issues.push(`중·하 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
    }
  }

  if (byTier.상.length && byTier.하.length && !byTier.중.length) {
    const minH = Math.min(...byTier.상.map((x) => x.point));
    const maxL = Math.max(...byTier.하.map((x) => x.point));
    if (minH <= maxL) {
      issues.push("하 난이도 최고 배점이 상 난이도 최저 배점 이상입니다. (상 > 하 필요)");
    } else if (round1(minH - maxL) < betweenGap - 0.01) {
      issues.push(`상·하 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
    }
  }

  return { ok: issues.length === 0, issues, sum };
}

function renderEditor() {
  const tbody = document.getElementById("editor-body");
  tbody.innerHTML = state.selectedQuestions
    .map(
      (q, i) => `
    <tr data-index="${i}">
      <td>${i + 1}</td>
      <td>
        <select class="tier-input tier-input-${TIER_KEYS[q.tier]}" data-index="${i}">
          ${TIER_ORDER.map(
            (t) => `<option value="${t}"${q.tier === t ? " selected" : ""}>${t}</option>`
          ).join("")}
        </select>
      </td>
      <td>
        <input type="number" class="point-input" data-index="${i}" value="${q.point.toFixed(1)}" step="0.1" min="0.1">
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll(".point-input").forEach((input) => {
    input.addEventListener("input", onEditorInput);
  });
  tbody.querySelectorAll(".tier-input").forEach((input) => {
    input.addEventListener("change", onEditorTierChange);
  });

  updateEditorValidation();
}

function onEditorInput(e) {
  const idx = parseInt(e.target.dataset.index, 10);
  const val = parseFloat(e.target.value);
  state.selectedQuestions[idx].point = Number.isFinite(val) ? val : NaN;
  updateEditorValidation();
}

function onEditorTierChange(e) {
  const idx = parseInt(e.target.dataset.index, 10);
  state.selectedQuestions[idx].tier = e.target.value;
  e.target.className = `tier-input tier-input-${TIER_KEYS[e.target.value]}`;
  updateEditorValidation();
}

function updateEditorValidation() {
  const validation = validateQuestions(state.selectedQuestions, state.betweenGap);
  const panel = document.getElementById("validation-panel");
  const groupsEl = document.getElementById("editor-groups");

  panel.className = validation.ok ? "validation-panel ok" : "validation-panel err";
  panel.innerHTML = validation.ok
    ? `<div class="validation-status">검증 통과</div><div class="validation-detail">총점 ${validation.sum.toFixed(1)}점 · 상>중>하 · 난이도 간 간격 충족</div>`
    : `<div class="validation-status">검증 미통과</div><ul class="validation-issues">${validation.issues.map((x) => `<li>${x}</li>`).join("")}</ul>`;

  const validQuestions = state.selectedQuestions.filter((q) => Number.isFinite(q.point) && q.point > 0);
  if (validQuestions.length) {
    groupsEl.innerHTML = renderGroupSummaryHtml(summarizeByGroups(validQuestions));
  } else {
    groupsEl.innerHTML = "";
  }

  const tbody = document.getElementById("editor-body");
  tbody.querySelectorAll("tr").forEach((row) => {
    const idx = parseInt(row.dataset.index, 10);
    const q = state.selectedQuestions[idx];
    const bad = !Number.isFinite(q.point) || q.point <= 0 || hasMoreThanOneDecimal(q.point);
    row.classList.toggle("row-error", bad);
  });
}

function backToProposals() {
  document.getElementById("editor-section").hidden = true;
  document.getElementById("result-section").hidden = false;
  state.selectedVariantId = null;
  state.selectedQuestions = [];
}

function formatExportFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `시험배점표_${y}-${m}-${d}.xlsx`;
}

function buildExportRows() {
  const questions = state.selectedQuestions;
  const validation = validateQuestions(questions, state.betweenGap);
  const label = document.getElementById("selected-label").textContent || "";
  const sum = round1(questions.reduce((a, q) => a + (Number.isFinite(q.point) ? q.point : 0), 0));
  const groupSummary = summarizeByGroups(
    questions.filter((q) => Number.isFinite(q.point) && q.point > 0)
  );

  const rows = [
    ["선택 안", label],
    ["총 문항 수", questions.length],
    ["총 배점", `${sum.toFixed(1)}점`],
    ["난이도 간 간격", `${state.betweenGap}점`],
    [],
    ["문항", "난이도", "배점"],
  ];

  questions.forEach((q, i) => {
    rows.push([
      i + 1,
      q.tier,
      Number.isFinite(q.point) ? q.point : "",
    ]);
  });

  rows.push([]);
  rows.push(["난이도별 배점 요약"]);
  rows.push(["난이도", "문항 수", "소계", "배점 구성"]);

  for (const g of groupSummary) {
    rows.push([g.tier, g.count, g.subtotal, g.groupText]);
  }

  rows.push([]);
  if (validation.ok) {
    rows.push([`검증: 통과 (총점 ${validation.sum.toFixed(1)}점)`]);
  } else {
    rows.push(["검증: 미통과"]);
    for (const issue of validation.issues) {
      rows.push(["", issue]);
    }
  }

  return rows;
}

function exportToExcel() {
  if (!state.selectedQuestions.length) return;

  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침해 주세요.");
    return;
  }

  const rows = buildExportRows();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 48 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "배점표");
  XLSX.writeFile(wb, formatExportFilename());
}

function onExportClick() {
  if (!state.selectedQuestions.length) {
    alert("먼저 추천안을 선택해 주세요.");
    return;
  }
  exportToExcel();
}

function onCalculate() {
  const input = readInputs();
  const baseErr = validateInput(input, input.groupCounts, input.betweenGap);
  const errorEl = document.getElementById("error-msg");

  if (baseErr) {
    errorEl.textContent = baseErr;
    errorEl.hidden = false;
    document.getElementById("result-section").hidden = true;
    document.getElementById("editor-section").hidden = true;
    return;
  }

  errorEl.hidden = true;
  state.variants = recommendAll(input);
  renderProposals(state.variants);
}

["total", "count-high", "count-mid", "count-low"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateSumStatus);
});

document.getElementById("calculate-btn").addEventListener("click", onCalculate);
document.getElementById("back-btn").addEventListener("click", backToProposals);
document.getElementById("export-btn").addEventListener("click", onExportClick);
updateSumStatus();
