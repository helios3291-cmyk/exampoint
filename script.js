const TIER_ORDER = ["상", "중", "하"];
const DISPLAY_TIER_ORDER = ["하", "중", "상"];
const TIER_KEYS = { 상: "high", 중: "mid", 하: "low" };
const CHOICE_SCORE_INTERVAL = 0.1;
const WRITTEN_SCORE_INTERVAL = 1;
const WRITTEN_BETWEEN_GAP = 1;
const TOTAL_SCORE = 100;

const VARIANT_PROFILES = [
  { id: "front", label: "안 A · 고배점 문항 강화형", distribution: "front" },
  { id: "balanced", label: "안 B · 균형형", distribution: "balanced" },
  { id: "back", label: "안 C · 저배점 문항 보강형", distribution: "back" },
];

const state = {
  variants: [],
  selectedVariantId: null,
  selectedQuestions: [],
  partTargets: {},
  partGaps: {},
  dragSourceIndex: null,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function roundToInterval(n, interval) {
  return round1(Math.round(n / interval) * interval);
}

function formatPoint(point) {
  return Number.isInteger(point) ? String(point) : point.toFixed(1);
}

function readTierCounts(prefix) {
  return {
    상: parseInt(document.getElementById(`${prefix}-high`).value, 10) || 0,
    중: parseInt(document.getElementById(`${prefix}-mid`).value, 10) || 0,
    하: parseInt(document.getElementById(`${prefix}-low`).value, 10) || 0,
  };
}

function readGroupCounts(prefix) {
  return {
    상: parseInt(document.getElementById(`${prefix}-high`).value, 10) || 3,
    중: parseInt(document.getElementById(`${prefix}-mid`).value, 10) || 4,
    하: parseInt(document.getElementById(`${prefix}-low`).value, 10) || 3,
  };
}

function readOptionalPoint(id) {
  const raw = document.getElementById(id).value.trim();
  return raw === "" ? null : parseFloat(raw);
}

function readInputs() {
  const writtenEnabled = document.getElementById("written-enabled").checked;
  const choiceTarget = writtenEnabled ? parseFloat(document.getElementById("choice-score-total").value) : TOTAL_SCORE;
  const writtenTarget = writtenEnabled ? parseFloat(document.getElementById("written-score-total").value) : 0;
  const parts = [
    {
      id: "choice",
      label: "선택형",
      total: parseInt(document.getElementById("total").value, 10),
      counts: readTierCounts("count"),
      targetTotal: choiceTarget,
      anchor1: parseFloat(document.getElementById("anchor1").value),
      anchor2: readOptionalPoint("anchor2"),
      groupCounts: readGroupCounts("group"),
      betweenGap: parseFloat(document.getElementById("between-gap").value),
      scoreInterval: CHOICE_SCORE_INTERVAL,
    },
  ];

  if (writtenEnabled) {
    parts.push({
      id: "written",
      label: "서답형",
      total: parseInt(document.getElementById("written-total").value, 10),
      counts: readTierCounts("written-count"),
      targetTotal: writtenTarget,
      anchor1: parseFloat(document.getElementById("written-anchor1").value),
      anchor2: readOptionalPoint("written-anchor2"),
      groupCounts: readGroupCounts("written-group"),
      betweenGap: WRITTEN_BETWEEN_GAP,
      scoreInterval: WRITTEN_SCORE_INTERVAL,
    });
  }

  return {
    writtenEnabled,
    choiceTarget,
    writtenTarget,
    parts,
  };
}

function getPartGroupCounts(part) {
  const result = {};
  for (const tier of TIER_ORDER) {
    result[tier] = part.counts[tier] > 0 ? part.groupCounts[tier] : 0;
  }
  return result;
}

function updateSumStatus() {
  const input = readInputs();
  const choice = input.parts[0];
  const sum = choice.counts.상 + choice.counts.중 + choice.counts.하;
  const el = document.getElementById("sum-status");
  if (sum === choice.total) {
    el.textContent = `선택형 자동 합계: ${sum} / ${choice.total}`;
    el.className = "sum-status ok";
  } else {
    el.textContent = `선택형 자동 합계: ${sum} / ${choice.total} — 불일치!`;
    el.className = "sum-status err";
  }

  updateWrittenPanel(input);
  updateScoreSplitStatus(input);
}

function updateWrittenPanel(input = readInputs()) {
  const panel = document.getElementById("written-options");
  const scoreSplit = document.getElementById("score-split");
  panel.hidden = !input.writtenEnabled;
  scoreSplit.hidden = !input.writtenEnabled;

  const el = document.getElementById("written-sum-status");
  if (!input.writtenEnabled) {
    el.textContent = "";
    el.className = "sum-status ok";
    return;
  }

  const written = input.parts.find((part) => part.id === "written");
  const sum = written.counts.상 + written.counts.중 + written.counts.하;
  if (sum === written.total) {
    el.textContent = `서답형 자동 합계: ${sum} / ${written.total}`;
    el.className = "sum-status ok";
  } else {
    el.textContent = `서답형 자동 합계: ${sum} / ${written.total} — 불일치!`;
    el.className = "sum-status err";
  }
}

function updateScoreSplitStatus(input = readInputs()) {
  const el = document.getElementById("score-split-status");
  if (!input.writtenEnabled) {
    el.textContent = "총점: 100.0점";
    el.className = "sum-status ok";
    return;
  }

  const sum = round1(input.choiceTarget + input.writtenTarget);
  if (Math.abs(sum - TOTAL_SCORE) < 0.05) {
    el.textContent = `선택형·서답형 총점: ${sum.toFixed(1)} / ${TOTAL_SCORE.toFixed(1)}`;
    el.className = "sum-status ok";
  } else {
    el.textContent = `선택형·서답형 총점: ${sum.toFixed(1)} / ${TOTAL_SCORE.toFixed(1)} — 불일치!`;
    el.className = "sum-status err";
  }
}

function balancedOrder(size) {
  const middle = Math.floor((size - 1) / 2);
  const order = [middle];
  for (let offset = 1; order.length < size; offset++) {
    const left = middle - offset;
    const right = middle + offset;
    if (right < size) order.push(right);
    if (left >= 0) order.push(left);
  }
  return order;
}

function distributeQuestionCounts(questionCount, numGroups, distribution) {
  if (numGroups <= 0) return [];
  if (numGroups === 1) return [questionCount];

  const counts = new Array(numGroups).fill(1);
  let remaining = questionCount - numGroups;
  const orders = {
    front: [...Array(numGroups).keys()],
    balanced: balancedOrder(numGroups),
    back: [...Array(numGroups).keys()].reverse(),
  };
  const order = orders[distribution] || orders.balanced;

  for (let i = 0; remaining > 0; i++, remaining--) {
    counts[order[i % order.length]]++;
  }

  // When the division is perfectly even, nudge the two non-balanced variants so
  // the three proposals still differ by 문항 수 분포, not by 배점 종류 수.
  if (questionCount > numGroups && questionCount % numGroups === 0) {
    if (distribution === "front" && counts[numGroups - 1] > 1) {
      counts[0]++;
      counts[numGroups - 1]--;
    } else if (distribution === "back" && counts[0] > 1) {
      counts[numGroups - 1]++;
      counts[0]--;
    }
  }

  return counts;
}

function generateTierGroups(maxPoint, questionCount, groupCount, distribution, scoreInterval) {
  if (questionCount <= 0) return [];

  const numGroups = Math.min(groupCount, questionCount);
  const counts = distributeQuestionCounts(questionCount, numGroups, distribution);
  const groups = [];

  for (let i = 0; i < numGroups; i++) {
    const point = roundToInterval(maxPoint - i * scoreInterval, scoreInterval);
    const assign = counts[i];
    groups.push({ point, count: assign });
  }

  return groups;
}

function expandGroupsToQuestions(groups, tier) {
  const questions = [];
  groups.forEach(({ point, count }, groupIndex) => {
    for (let i = 0; i < count; i++) {
      questions.push({ tier, point, scoreGroupId: `${tier}-${groupIndex}` });
    }
  });
  return questions;
}

function tierMaxFromAbove(minAbove, betweenGap) {
  return round1(minAbove - betweenGap);
}

function minPointOfGroups(groups) {
  if (!groups.length) return Infinity;
  return groups[groups.length - 1].point;
}

function buildInitialStructure(part, groupCounts, betweenGap, distribution) {
  const { counts, anchor1, anchor2, scoreInterval } = part;
  const tierGroups = [];

  if (counts.상 > 0) {
    tierGroups.push({
      tier: "상",
      groups: generateTierGroups(anchor1, counts.상, groupCounts.상, distribution, scoreInterval),
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
      groups: generateTierGroups(maxM, counts.중, groupCounts.중, distribution, scoreInterval),
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
      groups: generateTierGroups(maxL, counts.하, groupCounts.하, distribution, scoreInterval),
    });
  }

  let questions = [];
  for (const { tier, groups } of tierGroups) {
    questions.push(...expandGroupsToQuestions(groups, tier));
  }

  if (anchor2 !== null && counts.하 > 0) {
    const lowPoints = questions.filter((q) => q.tier === "하").map((q) => q.point);
    const currentMinL = Math.min(...lowPoints);
    const shift = roundToInterval(anchor2 - currentMinL, scoreInterval);
    questions = questions.map((q) => ({ ...q, point: roundToInterval(q.point + shift, scoreInterval) }));
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

function preservesGroupCounts(questions, groupCounts) {
  for (const tier of DISPLAY_TIER_ORDER) {
    const tierQuestions = questions.filter((q) => q.tier === tier);
    if (!tierQuestions.length) continue;
    const uniquePoints = new Set(tierQuestions.map((q) => q.point.toFixed(1)));
    if (uniquePoints.size !== groupCounts[tier]) return false;
  }
  return true;
}

function collectScoreGroups(questions) {
  const groups = [];
  const byId = new Map();
  for (const q of questions) {
    if (!byId.has(q.scoreGroupId)) {
      const group = { id: q.scoreGroupId, point: q.point, count: 0 };
      byId.set(q.scoreGroupId, group);
      groups.push(group);
    }
    byId.get(q.scoreGroupId).count++;
  }
  return groups;
}

function sumGroups(groups) {
  return round1(groups.reduce((sum, group) => sum + group.point * group.count, 0));
}

function findGroupAdjustmentSteps(groups, units, scoreInterval) {
  if (units === 0) return new Array(groups.length).fill(0);

  const direction = units > 0 ? 1 : -1;
  const target = Math.abs(units);
  let states = new Map([[0, { steps: new Array(groups.length).fill(0), cost: 0 }]]);

  groups.forEach((group, groupIndex) => {
    const nextStates = new Map(states);
    const priorityCost = direction > 0 ? groupIndex : groups.length - 1 - groupIndex;
    const maxSteps =
      direction > 0
        ? Math.ceil(target / group.count) + 2
        : Math.max(0, Math.round((group.point - scoreInterval) / scoreInterval));

    for (const [sum, state] of states.entries()) {
      for (let stepCount = 1; stepCount <= maxSteps; stepCount++) {
        const nextSum = sum + group.count * stepCount;
        if (nextSum > target) break;
        const nextCost = state.cost + priorityCost * stepCount;
        const existing = nextStates.get(nextSum);
        if (existing && existing.cost <= nextCost) continue;

        const nextSteps = state.steps.slice();
        nextSteps[groupIndex] = stepCount * direction;
        nextStates.set(nextSum, { steps: nextSteps, cost: nextCost });
      }
    }

    states = nextStates;
  });

  const result = states.get(target);
  return result ? result.steps : null;
}

function adjustToTarget(questions, targetTotal, scoreInterval) {
  if (!questions.length) return questions;

  const groups = collectScoreGroups(questions);
  let delta = round1(targetTotal - sumGroups(groups));

  if (Math.abs(delta) >= 0.05) {
    const uniformShift = roundToInterval(delta / questions.length, scoreInterval);
    if (uniformShift !== 0 && groups.every((group) => roundToInterval(group.point + uniformShift, scoreInterval) > 0)) {
      groups.forEach((group) => {
        group.point = roundToInterval(group.point + uniformShift, scoreInterval);
      });
    }
  }

  delta = round1(targetTotal - sumGroups(groups));
  const units = Math.round(delta / scoreInterval);
  const steps = findGroupAdjustmentSteps(groups, units, scoreInterval);

  if (steps) {
    groups.forEach((group, index) => {
      group.point = roundToInterval(group.point + steps[index] * scoreInterval, scoreInterval);
    });
  }

  const pointByGroupId = new Map(groups.map((group) => [group.id, group.point]));
  return questions.map((q) => ({ ...q, point: pointByGroupId.get(q.scoreGroupId) }));
}

function validatePartInput(part, groupCounts) {
  const { id, label, total, counts, targetTotal, anchor1, anchor2, betweenGap, scoreInterval } = part;
  const sum = counts.상 + counts.중 + counts.하;

  if (!Number.isFinite(total) || total < 1) return `${label} 총 문항 수를 1 이상으로 입력해 주세요.`;
  if (sum !== total) return `${label} 난이도별 문항 수 합(${sum})이 총 문항 수(${total})와 일치하지 않습니다.`;
  if (sum === 0) return `${label} 문항 수가 0입니다.`;
  if (!Number.isFinite(targetTotal) || targetTotal <= 0) return `${label} 총점을 0보다 크게 입력해 주세요.`;
  if (id === "written" && !Number.isInteger(targetTotal)) {
    return "서답형 목표 점수는 정수로 입력해 주세요.";
  }
  if (!Number.isFinite(anchor1) || anchor1 <= 0) return `${label} 배점 예시 1을 0보다 크게 입력해 주세요.`;
  if (anchor2 !== null && (!Number.isFinite(anchor2) || anchor2 <= 0)) return `${label} 배점 예시 2가 올바르지 않습니다.`;
  if (anchor2 !== null && anchor2 >= anchor1) return `${label} 배점 예시 2는 예시 1보다 작아야 합니다.`;
  if (id === "written" && (!Number.isInteger(anchor1) || (anchor2 !== null && !Number.isInteger(anchor2)))) {
    return "서답형 배점 예시는 정수로 입력해 주세요. 소수점 배점은 추천안 선택 후 직접 수정할 수 있습니다.";
  }
  if (!Number.isFinite(betweenGap) || betweenGap <= 0) return `${label} 난이도 간 최소 간격을 0보다 크게 입력해 주세요.`;

  for (const tier of TIER_ORDER) {
    if (counts[tier] === 0) continue;
    const gc = groupCounts[tier];
    if (!Number.isFinite(gc) || gc < 1) return `${label} ${tier} 난이도 배점 종류 수는 1 이상이어야 합니다.`;
    if (gc > counts[tier]) return `${label} ${tier} 난이도 배점 종류 수(${gc})가 문항 수(${counts[tier]})보다 많습니다.`;
  }

  const minNeeded =
    (counts.상 > 0 ? (groupCounts.상 - 1) * scoreInterval : 0) +
    (counts.중 > 0 ? (groupCounts.중 - 1) * scoreInterval : 0) +
    (counts.하 > 0 ? (groupCounts.하 - 1) * scoreInterval : 0);

  const gaps =
    (counts.상 > 0 && counts.중 > 0 ? betweenGap : 0) +
    (counts.중 > 0 && counts.하 > 0 ? betweenGap : 0) +
    (counts.상 > 0 && counts.하 > 0 && counts.중 === 0 ? betweenGap : 0);

  if (anchor1 - minNeeded - gaps < 0.5) {
    return `${label} 문항 수·배점 종류 대비 배점 예시가 너무 낮습니다. 예시 배점을 높이거나 배점 종류 수를 줄여 주세요.`;
  }

  return null;
}

function validateFullInput(input) {
  const targetSum = round1(input.parts.reduce((sum, part) => sum + part.targetTotal, 0));
  if (Math.abs(targetSum - TOTAL_SCORE) >= 0.05) {
    return `선택형·서답형 총점 합이 ${targetSum.toFixed(1)}점입니다. ${TOTAL_SCORE.toFixed(1)}점이 되도록 조정해 주세요.`;
  }

  for (const part of input.parts) {
    const err = validatePartInput(part, getPartGroupCounts(part));
    if (err) return err;
  }

  return null;
}

function formatGroupCountsMeta(groupCounts, counts) {
  return TIER_ORDER.filter((t) => counts[t] > 0)
    .map((t) => `${t} ${groupCounts[t]}종`)
    .join(" / ");
}

function recommendPart(part, profile) {
  const groupCounts = getPartGroupCounts(part);
  const betweenGap = part.betweenGap;

  const err = validatePartInput(part, groupCounts);
  if (err) return { error: err, questions: null, groupCounts, part };

  let questions = buildInitialStructure(part, groupCounts, betweenGap, profile.distribution);

  if (questions.some((q) => q.point <= 0)) {
    return { error: `${part.label} 계산 결과에 0 이하 배점이 생깁니다.`, questions: null, groupCounts, part };
  }

  questions = adjustToTarget(questions, part.targetTotal, part.scoreInterval).map((q) => ({
    ...q,
    partId: part.id,
    partLabel: part.label,
  }));

  if (!preservesGroupCounts(questions, groupCounts)) {
    return { error: `${part.label} 입력한 배점 종류 수를 유지할 수 없습니다. 배점 예시나 배점 종류 수를 조정해 주세요.`, questions: null, groupCounts, part };
  }

  if (!checkOrdering(questions, betweenGap)) {
    return { error: `${part.label} 상>중>하 순서 또는 난이도 간 간격을 유지할 수 없습니다.`, questions: null, groupCounts, part };
  }

  const totalSum = round1(questions.reduce((a, q) => a + q.point, 0));
  if (Math.abs(totalSum - part.targetTotal) >= 0.05) {
    return { error: `${part.label} ${part.targetTotal.toFixed(1)}점 맞춤에 실패했습니다.`, questions: null, groupCounts, part };
  }

  return {
    error: null,
    questions,
    part,
    groupCounts,
    betweenGap,
    stats: tierStats(questions),
    groupSummary: summarizeByGroups(questions),
  };
}

function recommendVariant(input, profile) {
  const err = validateFullInput(input);
  if (err) return { ...profile, error: err, questions: null, partResults: [] };

  const partResults = [];
  let questions = [];

  for (const part of input.parts) {
    const result = recommendPart(part, profile);
    partResults.push(result);
    if (result.error) {
      return { ...profile, error: result.error, questions: null, partResults };
    }
    questions = questions.concat(result.questions);
  }

  const totalSum = round1(questions.reduce((a, q) => a + q.point, 0));
  if (Math.abs(totalSum - TOTAL_SCORE) >= 0.05) {
    return { ...profile, error: "선택형·서답형 합산 100점 맞춤에 실패했습니다.", questions: null, partResults };
  }

  return {
    ...profile,
    error: null,
    questions,
    partResults,
    totalSum,
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

  for (const tier of DISPLAY_TIER_ORDER) {
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
    const groupText = groups.map((g) => `${formatPoint(g.point)}점 ${g.count}문항`).join(", ");

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
          <strong>${g.tier}</strong> ${g.count}문항 · 소계 ${formatPoint(g.subtotal)}점
        </div>
        <div class="group-tier-detail">${g.groupText}</div>
      </div>`
    )
    .join("");
}

function renderPartResultHtml(partResult) {
  const { part, stats, groupCounts, betweenGap, groupSummary } = partResult;
  const badges = TIER_ORDER.filter((t) => stats[t])
    .map(
      (t) =>
        `<span class="tier-badge ${TIER_KEYS[t]}">${t} ${stats[t].count}문항 · ${formatPoint(stats[t].max)}~${formatPoint(stats[t].min)}점 · 소계 ${formatPoint(stats[t].subtotal)}점</span>`
    )
    .join("");

  return `
    <div class="part-result">
      <div class="part-result-head">
        <strong>${part.label}</strong>
        <span>${part.total}문항 · ${formatPoint(part.targetTotal)}점</span>
      </div>
      <div class="meta">난이도 간 ${formatPoint(betweenGap)}점 · ${formatGroupCountsMeta(groupCounts, part.counts)}</div>
      <div class="tier-summary">${badges}</div>
      <div class="proposal-groups">${renderGroupSummaryHtml(groupSummary)}</div>
    </div>`;
}

function renderProposals(variants) {
  const section = document.getElementById("result-section");
  const editorSection = document.getElementById("editor-section");
  section.hidden = false;
  editorSection.hidden = true;

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

      return `
      <article class="proposal-card" data-variant="${v.id}">
        <h3>${v.label}</h3>
        <div class="proposal-summary">
          <div class="total">총점: ${formatPoint(v.totalSum)}점</div>
          <div class="meta">입력한 배점 종류 수는 유지하고, 배점별 문항 수 분포만 조정합니다.</div>
        </div>
        <div class="part-results">${v.partResults.map(renderPartResultHtml).join("")}</div>
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
  state.selectedQuestions = orderQuestionsForEditing(variant.questions).map((q) => ({ ...q }));
  state.partTargets = {};
  state.partGaps = {};
  variant.partResults.forEach((partResult) => {
    state.partTargets[partResult.part.id] = partResult.part.targetTotal;
    state.partGaps[partResult.part.id] = partResult.part.betweenGap;
  });

  document.getElementById("result-section").hidden = true;
  document.getElementById("editor-section").hidden = false;
  document.getElementById("selected-label").textContent = variant.label;

  renderEditor();
}

function orderQuestionsForEditing(questions) {
  const partOrder = [...new Set(questions.map((q) => q.partId))];
  return questions
    .map((q, index) => ({ ...q, originalIndex: index }))
    .sort((a, b) => {
      const partDiff = partOrder.indexOf(a.partId) - partOrder.indexOf(b.partId);
      if (partDiff !== 0) return partDiff;

      const tierDiff = DISPLAY_TIER_ORDER.indexOf(a.tier) - DISPLAY_TIER_ORDER.indexOf(b.tier);
      if (tierDiff !== 0) return tierDiff;

      const pointDiff = a.point - b.point;
      if (pointDiff !== 0) return pointDiff;

      return a.originalIndex - b.originalIndex;
    })
    .map(({ originalIndex, ...q }) => q);
}

function hasMoreThanOneDecimal(value) {
  const s = String(value);
  const dot = s.indexOf(".");
  if (dot === -1) return false;
  return s.length - dot - 1 > 1;
}

function validateQuestions(questions, partTargets, partGaps) {
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
  if (Math.abs(sum - TOTAL_SCORE) >= 0.05) {
    const diff = round1(TOTAL_SCORE - sum);
    const dir = diff > 0 ? `${diff.toFixed(1)}점 더 필요` : `${Math.abs(diff).toFixed(1)}점 줄여야 함`;
    issues.push(`총점 ${sum.toFixed(1)}점 — ${TOTAL_SCORE.toFixed(1)}점이 되도록 ${dir}`);
  }

  const byPart = new Map();
  questions.forEach((q, i) => {
    if (!byPart.has(q.partId)) {
      byPart.set(q.partId, {
        label: q.partLabel,
        byTier: { 상: [], 중: [], 하: [] },
        sum: 0,
      });
    }
    const part = byPart.get(q.partId);
    if (Number.isFinite(q.point) && q.point > 0) {
      part.byTier[q.tier].push({ point: q.point, num: i + 1 });
      part.sum = round1(part.sum + q.point);
    }
  });

  byPart.forEach((part, partId) => {
    const target = partTargets[partId];
    const betweenGap = partGaps[partId];
    if (Number.isFinite(target) && Math.abs(part.sum - target) >= 0.05) {
      const diff = round1(target - part.sum);
      const dir = diff > 0 ? `${diff.toFixed(1)}점 더 필요` : `${Math.abs(diff).toFixed(1)}점 줄여야 함`;
      issues.push(`${part.label} 소계 ${part.sum.toFixed(1)}점 — 목표 ${target.toFixed(1)}점이 되도록 ${dir}`);
    }

    const byTier = part.byTier;
    if (byTier.상.length && byTier.중.length) {
      const minH = Math.min(...byTier.상.map((x) => x.point));
      const maxM = Math.max(...byTier.중.map((x) => x.point));
      if (minH <= maxM) {
        issues.push(`${part.label}: 중 난이도 최고 배점이 상 난이도 최저 배점 이상입니다. (상 > 중 필요)`);
      } else if (round1(minH - maxM) < betweenGap - 0.01) {
        issues.push(`${part.label}: 상·중 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
      }
    }

    if (byTier.중.length && byTier.하.length) {
      const minM = Math.min(...byTier.중.map((x) => x.point));
      const maxL = Math.max(...byTier.하.map((x) => x.point));
      if (minM <= maxL) {
        issues.push(`${part.label}: 하 난이도 최고 배점이 중 난이도 최저 배점 이상입니다. (중 > 하 필요)`);
      } else if (round1(minM - maxL) < betweenGap - 0.01) {
        issues.push(`${part.label}: 중·하 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
      }
    }

    if (byTier.상.length && byTier.하.length && !byTier.중.length) {
      const minH = Math.min(...byTier.상.map((x) => x.point));
      const maxL = Math.max(...byTier.하.map((x) => x.point));
      if (minH <= maxL) {
        issues.push(`${part.label}: 하 난이도 최고 배점이 상 난이도 최저 배점 이상입니다. (상 > 하 필요)`);
      } else if (round1(minH - maxL) < betweenGap - 0.01) {
        issues.push(`${part.label}: 상·하 사이 간격이 ${betweenGap.toFixed(1)}점 미만입니다.`);
      }
    }
  });

  return { ok: issues.length === 0, issues, sum };
}

function renderEditor() {
  const tbody = document.getElementById("editor-body");
  tbody.innerHTML = state.selectedQuestions
    .map(
      (q, i) => `
    <tr data-index="${i}" draggable="true">
      <td class="drag-cell" title="같은 유형 안에서 드래그해 난이도와 배점을 바꿉니다.">↕</td>
      <td>${q.partLabel}</td>
      <td>${i + 1}</td>
      <td>
        <select class="tier-input tier-input-${TIER_KEYS[q.tier]}" data-index="${i}">
          ${DISPLAY_TIER_ORDER.map(
            (t) => `<option value="${t}"${q.tier === t ? " selected" : ""}>${t}</option>`
          ).join("")}
        </select>
      </td>
      <td>
        <input type="number" class="point-input" data-index="${i}" value="${formatPoint(q.point)}" step="0.1" min="0.1">
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
  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("dragstart", onEditorDragStart);
    row.addEventListener("dragover", onEditorDragOver);
    row.addEventListener("dragleave", onEditorDragLeave);
    row.addEventListener("drop", onEditorDrop);
    row.addEventListener("dragend", onEditorDragEnd);
  });

  updateEditorValidation();
}

function isEditorSwapAllowed(sourceIndex, targetIndex) {
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) return false;
  if (sourceIndex === targetIndex) return false;

  const source = state.selectedQuestions[sourceIndex];
  const target = state.selectedQuestions[targetIndex];
  return Boolean(source && target && source.partId === target.partId);
}

function clearEditorDragClasses() {
  document.querySelectorAll("#editor-body tr").forEach((row) => {
    row.classList.remove("dragging", "drop-allowed", "drop-blocked");
  });
}

function onEditorDragStart(e) {
  if (e.target.closest("input, select")) {
    e.preventDefault();
    return;
  }

  const row = e.currentTarget;
  const idx = parseInt(row.dataset.index, 10);
  state.dragSourceIndex = idx;
  row.classList.add("dragging");

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }
}

function onEditorDragOver(e) {
  const targetIndex = parseInt(e.currentTarget.dataset.index, 10);
  const allowed = isEditorSwapAllowed(state.dragSourceIndex, targetIndex);
  e.currentTarget.classList.toggle("drop-allowed", allowed);
  e.currentTarget.classList.toggle("drop-blocked", !allowed && state.dragSourceIndex !== null);

  if (allowed) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  }
}

function onEditorDragLeave(e) {
  e.currentTarget.classList.remove("drop-allowed", "drop-blocked");
}

function onEditorDrop(e) {
  const targetIndex = parseInt(e.currentTarget.dataset.index, 10);
  if (!isEditorSwapAllowed(state.dragSourceIndex, targetIndex)) return;

  e.preventDefault();
  swapQuestionScoring(state.dragSourceIndex, targetIndex);
  state.dragSourceIndex = null;
  renderEditor();
}

function onEditorDragEnd() {
  state.dragSourceIndex = null;
  clearEditorDragClasses();
}

function swapQuestionScoring(sourceIndex, targetIndex) {
  const source = state.selectedQuestions[sourceIndex];
  const target = state.selectedQuestions[targetIndex];
  const sourceValues = { tier: source.tier, point: source.point };

  source.tier = target.tier;
  source.point = target.point;
  target.tier = sourceValues.tier;
  target.point = sourceValues.point;
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

function renderEditorGroupSummaryHtml(questions) {
  const parts = [];
  for (const q of questions) {
    let part = parts.find((p) => p.id === q.partId);
    if (!part) {
      part = { id: q.partId, label: q.partLabel, questions: [] };
      parts.push(part);
    }
    part.questions.push(q);
  }

  return parts
    .map((part) => {
      const subtotal = round1(part.questions.reduce((sum, q) => sum + q.point, 0));
      return `
        <div class="editor-part-summary">
          <div class="part-result-head">
            <strong>${part.label}</strong>
            <span>소계 ${subtotal.toFixed(1)}점</span>
          </div>
          ${renderGroupSummaryHtml(summarizeByGroups(part.questions))}
        </div>`;
    })
    .join("");
}

function updateEditorValidation() {
  const validation = validateQuestions(state.selectedQuestions, state.partTargets, state.partGaps);
  const panel = document.getElementById("validation-panel");
  const groupsEl = document.getElementById("editor-groups");

  panel.className = validation.ok ? "validation-panel ok" : "validation-panel err";
  panel.innerHTML = validation.ok
    ? `<div class="validation-status">검증 통과</div><div class="validation-detail">총점 ${validation.sum.toFixed(1)}점 · 유형별 목표 점수 · 상>중>하 · 난이도 간 간격 충족</div>`
    : `<div class="validation-status">검증 미통과</div><ul class="validation-issues">${validation.issues.map((x) => `<li>${x}</li>`).join("")}</ul>`;

  const validQuestions = state.selectedQuestions.filter((q) => Number.isFinite(q.point) && q.point > 0);
  if (validQuestions.length) {
    groupsEl.innerHTML = renderEditorGroupSummaryHtml(validQuestions);
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
  const validation = validateQuestions(questions, state.partTargets, state.partGaps);
  const label = document.getElementById("selected-label").textContent || "";
  const sum = round1(questions.reduce((a, q) => a + (Number.isFinite(q.point) ? q.point : 0), 0));
  const validQuestions = questions.filter((q) => Number.isFinite(q.point) && q.point > 0);
  const partIds = [...new Set(validQuestions.map((q) => q.partId))];

  const rows = [
    ["선택 안", label],
    ["총 문항 수", questions.length],
    ["총 배점", `${sum.toFixed(1)}점`],
    ["유형별 목표", partIds.map((partId) => {
      const sample = validQuestions.find((q) => q.partId === partId);
      return `${sample.partLabel} ${state.partTargets[partId].toFixed(1)}점`;
    }).join(" / ")],
    [],
    ["유형", "문항", "난이도", "배점"],
  ];

  questions.forEach((q, i) => {
    rows.push([
      q.partLabel,
      i + 1,
      q.tier,
      Number.isFinite(q.point) ? q.point : "",
    ]);
  });

  rows.push([]);
  rows.push(["유형·난이도별 배점 요약"]);
  rows.push(["유형", "난이도", "문항 수", "소계", "배점 구성"]);

  for (const partId of partIds) {
    const partQuestions = validQuestions.filter((q) => q.partId === partId);
    const partLabel = partQuestions[0].partLabel;
    for (const g of summarizeByGroups(partQuestions)) {
      rows.push([partLabel, g.tier, g.count, g.subtotal, g.groupText]);
    }
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
  ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 48 }];

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
  const baseErr = validateFullInput(input);
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

[
  "total",
  "count-high",
  "count-mid",
  "count-low",
  "choice-score-total",
  "written-score-total",
  "written-total",
  "written-count-high",
  "written-count-mid",
  "written-count-low",
].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateSumStatus);
});

document.getElementById("written-enabled").addEventListener("change", updateSumStatus);
document.getElementById("calculate-btn").addEventListener("click", onCalculate);
document.getElementById("back-btn").addEventListener("click", backToProposals);
document.getElementById("export-btn").addEventListener("click", onExportClick);
document.getElementById("export-bottom-btn").addEventListener("click", onExportClick);
updateSumStatus();
