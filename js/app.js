/**
 * MWA Mahasawat Water Treatment Plant - Filter Media Webapp Controller
 * ระบบควบคุมหน้าจอ กราฟจำลอง และการคำนวณสารกรอง โรงงานผลิตน้ำมหาสวัสดิ์
 */

(function () {
  'use strict';

  const M = window.FilterMediaModel;

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    activePresetId: 'phase1_2',
    activeSummaryMode: 'A_skim', // 'A_topup' | 'A_skim' | 'B' | 'C'
    sieveChartInstance: null,
    reverseChartInstance: null,
    lastCalculation: null,
    // Random multi-point / multi-depth sample sets for Sand & Anthracite
    randomSamples: {
      sand: [
        { id: 1, position: 'จุดที่ 1 (ด้านน้ำเข้า)', depthZone: 'สุ่มช่วงบน (0–30 ซม.)', layerDepthMeasured: 0.90, weight: 1.0, es: 0.98, uc: 1.44 },
        { id: 2, position: 'จุดที่ 2 (กลางบ่อ)', depthZone: 'สุ่มช่วงกลาง (30–60 ซม.)', layerDepthMeasured: 0.93, weight: 1.0, es: 1.04, uc: 1.46 },
        { id: 3, position: 'จุดที่ 3 (ท้ายบ่อ)', depthZone: 'สุ่มช่วงล่าง (60–90 ซม.)', layerDepthMeasured: 0.93, weight: 1.0, es: 1.08, uc: 1.50 }
      ],
      anthracite: [
        { id: 1, position: 'จุดที่ 1 (ด้านน้ำเข้า)', depthZone: 'สุ่มช่วงบน (0–25 ซม.)', layerDepthMeasured: 0.56, weight: 1.0, es: 1.59, uc: 1.54 },
        { id: 2, position: 'จุดที่ 2 (กลางบ่อ)', depthZone: 'สุ่มช่วงกลาง (25–55 ซม.)', layerDepthMeasured: 0.59, weight: 1.0, es: 1.65, uc: 1.57 },
        { id: 3, position: 'จุดที่ 3 (ท้ายบ่อ)', depthZone: 'สุ่มตลอดความลึก', layerDepthMeasured: 0.59, weight: 1.0, es: 1.68, uc: 1.60 }
      ]
    },
    batchItems: []
  };

  // Sample realistic defect data for each phase when switching presets
  const SAMPLE_DEFECTS = {
    phase1_2: {
      filterName: 'บ่อกรอง F-01 (เฟส 1 - Aquazur V)',
      sand: { currDepth: 0.92, currES: 1.03, currUC: 1.48 },
      anthracite: { currDepth: 0.0, currES: 1.40, currUC: 1.40 }
    },
    phase3: {
      filterName: 'บ่อกรอง F-301 (เฟส 3 - Dual Media)',
      anthracite: { currDepth: 0.58, currES: 1.64, currUC: 1.58 },
      sand: { currDepth: 0.62, currES: 1.01, currUC: 1.55 }
    },
    phase4: {
      filterName: 'บ่อกรอง F-401 (เฟส 4 - Dual Media)',
      anthracite: { currDepth: 0.44, currES: 1.38, currUC: 1.47 },
      sand: { currDepth: 0.53, currES: 0.71, currUC: 1.56 }
    },
    custom: {
      filterName: 'บ่อกรอง Custom-01',
      anthracite: { currDepth: 0.52, currES: 1.48, currUC: 1.52 },
      sand: { currDepth: 0.55, currES: 0.85, currUC: 1.55 }
    }
  };

  // =========================================================================
  // DOM HELPERS
  // =========================================================================
  function el(id) {
    return document.getElementById(id);
  }

  function fmt(num, digits = 2) {
    const n = Number(num);
    if (isNaN(n)) return '-';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function renderMath(targetEl) {
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(targetEl || document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {
        // ignore KaTeX render errors
      }
    }
  }

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================
  function initTabs() {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    const panels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        panels.forEach((p) => {
          if (p.id === targetId) {
            p.classList.remove('hidden');
          } else {
            p.classList.add('hidden');
          }
        });

        if (targetId === 'tab-replenish') {
          runMainCalculation();
        } else if (targetId === 'tab-reverse') {
          runReverseSolver();
        } else if (targetId === 'tab-backwash') {
          renderBackwashDiagnostics();
        } else if (targetId === 'tab-batch') {
          renderBatchTable();
        } else if (targetId === 'tab-academic' && window.renderMathInElement) {
          window.renderMathInElement(el('tab-academic'), {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false }
            ]
          });
        }
      });
    });
  }

  // =========================================================================
  // PRESET SELECTOR & INPUT INITIALIZATION
  // =========================================================================
  function renderPresetButtons() {
    const container = el('presetSelectorGrid');
    const presets = Object.values(M.PLANT_PRESETS);

    container.innerHTML = presets
      .map((p) => {
        const isActive = p.id === state.activePresetId;
        const layersDesc =
          p.filterType === 'single'
            ? `Sand: L = ${p.layers.sand.designDepth.toFixed(2)} m, ES = ${p.layers.sand.designESMin.toFixed(2)}–${p.layers.sand.designESMax.toFixed(2)} mm, UC = ${p.layers.sand.designUC.toFixed(1)}`
            : `Anthracite ${p.layers.anthracite.designDepth.toFixed(2)}m (ES ${p.layers.anthracite.designES}) + Sand ${p.layers.sand.designDepth.toFixed(2)}m (ES ${p.layers.sand.designES})`;

        return `
          <button type="button" class="preset-btn ${isActive ? 'active' : ''}" data-preset="${p.id}">
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold text-sm text-slate-900">${p.shortName}</span>
              <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">${p.unitArea} m²</span>
            </div>
            <div class="text-xs text-slate-600 mb-1">${p.numFiltersNote} • $v_F$ = ${p.normalFiltrationRate} m/h</div>
            <div class="text-xs font-semibold text-sky-800 num-mono">${layersDesc}</div>
          </button>
        `;
      })
      .join('');

    container.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-preset');
        applyPreset(presetId, true);
      });
    });
    renderMath(container);
  }

  function applyPreset(presetId, loadSampleDefect = true) {
    state.activePresetId = presetId;
    const preset = M.PLANT_PRESETS[presetId] || M.PLANT_PRESETS.phase1_2;
    const sample = SAMPLE_DEFECTS[presetId] || SAMPLE_DEFECTS.phase1_2;

    renderPresetButtons();
    el('activePresetBadge').textContent = preset.shortName;

    el('inputFilterArea').value = preset.unitArea;
    el('inputFiltrationRate').value = preset.normalFiltrationRate;

    // Backwash tab inputs sync
    el('bwHighRate').value = preset.backwash.highWashRate;
    el('bwLowRate').value = preset.backwash.lowWashRate;
    el('bwAirRate').value = preset.backwash.airScourRate;
    el('bwTroughFreeboard').value = preset.troughHeightAboveMedia;

    // Sand Design
    el('designDepthSand').value = preset.layers.sand.designDepth.toFixed(2);
    el('designESSand').value = preset.layers.sand.designES.toFixed(2);
    el('designUCSand').value = preset.layers.sand.designUC.toFixed(2);
    el('supplyESSand').value = preset.layers.sand.designES.toFixed(2);
    el('supplyUCSand').value = preset.layers.sand.designUC.toFixed(2);

    // Anthracite Design
    const anthCard = el('cardInputAnthracite');
    const chartSelect = el('selectChartLayer');
    const sampleTargetSelect = el('selectSampleLayerTarget');

    if (preset.layers.anthracite.enabled) {
      anthCard.classList.remove('hidden');
      el('layerInputsContainer').classList.remove('lg:grid-cols-1');
      el('layerInputsContainer').classList.add('lg:grid-cols-2');
      el('designDepthAnth').value = preset.layers.anthracite.designDepth.toFixed(2);
      el('designESAnth').value = preset.layers.anthracite.designES.toFixed(2);
      el('designUCAnth').value = preset.layers.anthracite.designUC.toFixed(2);
      el('supplyESAnth').value = preset.layers.anthracite.designES.toFixed(2);
      el('supplyUCAnth').value = preset.layers.anthracite.designUC.toFixed(2);
      chartSelect.querySelector('option[value="anthracite"]').disabled = false;
      sampleTargetSelect.querySelector('option[value="anthracite"]').disabled = false;
    } else {
      anthCard.classList.add('hidden');
      el('layerInputsContainer').classList.remove('lg:grid-cols-2');
      el('layerInputsContainer').classList.add('lg:grid-cols-1');
      chartSelect.value = 'sand';
      chartSelect.querySelector('option[value="anthracite"]').disabled = true;
      sampleTargetSelect.value = 'sand';
      sampleTargetSelect.querySelector('option[value="anthracite"]').disabled = true;
    }

    if (loadSampleDefect) {
      el('inputFilterName').value = sample.filterName;
      el('currDepthSand').value = sample.sand.currDepth.toFixed(2);
      el('currESSand').value = sample.sand.currES.toFixed(2);
      el('currUCSand').value = sample.sand.currUC.toFixed(2);

      if (preset.layers.anthracite.enabled) {
        el('currDepthAnth').value = sample.anthracite.currDepth.toFixed(2);
        el('currESAnth').value = sample.anthracite.currES.toFixed(2);
        el('currUCAnth').value = sample.anthracite.currUC.toFixed(2);
      } else {
        el('currDepthAnth').value = '0.00';
      }
    }

    // Sync Custom Simulator defaults with preset
    if (el('simSandES')) {
      el('simSandUnit').value = 'cm';
      el('lblSimSandVal').textContent = 'ปริมาณที่เติม (ซม.)';
      const missingSandCm = Math.max(0, (preset.layers.sand.designDepth - Number(el('currDepthSand').value)) * 100);
      el('simSandVal').value = missingSandCm.toFixed(1);
      el('simSandES').value = preset.layers.sand.designES.toFixed(2);
      el('simSandUC').value = preset.layers.sand.designUC.toFixed(2);
      el('simSandSkimCm').value = '0.0';

      el('simAnthUnit').value = 'cm';
      el('lblSimAnthVal').textContent = 'ปริมาณที่เติม (ซม.)';
      const missingAnthCm = preset.layers.anthracite.enabled
        ? Math.max(0, (preset.layers.anthracite.designDepth - Number(el('currDepthAnth').value)) * 100)
        : 0;
      el('simAnthVal').value = missingAnthCm.toFixed(1);
      el('simAnthES').value = preset.layers.anthracite.designES.toFixed(2);
      el('simAnthUC').value = preset.layers.anthracite.designUC.toFixed(2);
      el('simAnthSkimCm').value = '0.0';
      el('simTestVf').value = preset.normalFiltrationRate.toFixed(1);
    }

    renderRandomSamplesTable();
    runMainCalculation();
  }

  // =========================================================================
  // RANDOM MULTI-POINT / MULTI-DEPTH SAMPLING AGGREGATOR
  // =========================================================================
  function renderRandomSamplesTable() {
    const targetLayer = el('selectSampleLayerTarget').value; // 'sand' | 'anthracite'
    const samples = state.randomSamples[targetLayer] || [];
    const tbody = el('randomSamplesTableBody');

    tbody.innerHTML = samples
      .map(
        (s, idx) => `
        <tr>
          <td>
            <input type="text" class="form-input text-xs sample-input" data-idx="${idx}" data-field="position" value="${s.position}" />
          </td>
          <td>
            <input type="text" class="form-input text-xs sample-input" data-idx="${idx}" data-field="depthZone" value="${s.depthZone}" />
          </td>
          <td>
            <input type="number" step="0.01" min="0.05" class="form-input text-xs num-mono sample-input" data-idx="${idx}" data-field="layerDepthMeasured" value="${s.layerDepthMeasured}" />
          </td>
          <td>
            <input type="number" step="0.1" min="0.1" class="form-input text-xs num-mono sample-input" data-idx="${idx}" data-field="weight" value="${s.weight}" />
          </td>
          <td>
            <input type="number" step="0.01" min="0.2" class="form-input text-xs num-mono font-bold sample-input" data-idx="${idx}" data-field="es" value="${s.es}" />
          </td>
          <td>
            <input type="number" step="0.01" min="1.05" class="form-input text-xs num-mono font-bold sample-input" data-idx="${idx}" data-field="uc" value="${s.uc}" />
          </td>
          <td>
            <button type="button" class="btn-danger-outline sample-del-btn" data-idx="${idx}">ลบ</button>
          </td>
        </tr>
      `
      )
      .join('');

    tbody.querySelectorAll('.sample-input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const i = Number(inp.getAttribute('data-idx'));
        const f = inp.getAttribute('data-field');
        state.randomSamples[targetLayer][i][f] =
          f === 'position' || f === 'depthZone' ? inp.value : Number(inp.value);
        updateRandomSampleSummary();
      });
    });

    tbody.querySelectorAll('.sample-del-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-idx'));
        if (state.randomSamples[targetLayer].length > 1) {
          state.randomSamples[targetLayer].splice(i, 1);
          renderRandomSamplesTable();
        }
      });
    });

    updateRandomSampleSummary();
  }

  function updateRandomSampleSummary() {
    const targetLayer = el('selectSampleLayerTarget').value;
    const samples = state.randomSamples[targetLayer] || [];
    const agg = M.aggregateRandomSamples(samples);
    const box = el('randomSampleSummaryText');

    if (!agg) {
      box.innerHTML = 'กรุณากรอกข้อมูลตัวอย่างอย่างน้อย 1 จุด';
      return;
    }

    const layerLabel = targetLayer === 'anthracite' ? 'แอนทราไซต์ (Anthracite)' : 'ทรายกรอง (Sand)';
    box.innerHTML = `
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="font-bold text-sky-950">ผลรวมเชิงสถิติสำหรับ ${layerLabel} (${agg.sampleCount} จุดสุ่ม):</span>
        <span>ความลึกเฉลี่ย $\\bar{L}$ = <strong class="num-mono text-sky-900">${fmt(agg.meanDepth, 2)} m</strong> (±${fmt(agg.sdDepth, 2)} m, ช่วง ${fmt(agg.minDepth, 2)}–${fmt(agg.maxDepth, 2)} m)</span>
        <span>• Composite $ES (d_{10})$ = <strong class="num-mono text-emerald-700">${fmt(agg.es, 3)} mm</strong> (เฉลี่ยเลขคณิต ${fmt(agg.arithES, 3)})</span>
        <span>• Composite $UC$ = <strong class="num-mono text-emerald-700">${fmt(agg.uc, 3)}</strong> (เฉลี่ยเลขคณิต ${fmt(agg.arithUC, 3)})</span>
        <span>• $d_{60}$ = <strong class="num-mono">${fmt(agg.d60, 2)} mm</strong>, $d_{90}$ = <strong class="num-mono">${fmt(agg.d90, 2)} mm</strong></span>
      </div>
    `;
  }

  // =========================================================================
  // MAIN REPLENISHMENT CALCULATION (TAB 1)
  // =========================================================================
  function runMainCalculation() {
    const preset = M.PLANT_PRESETS[state.activePresetId] || M.PLANT_PRESETS.phase1_2;
    const filterName = el('inputFilterName').value || 'บ่อกรอง F-01';
    const filterArea = Math.max(1, Number(el('inputFilterArea').value) || preset.unitArea);
    const filtrationRate = Math.max(1, Number(el('inputFiltrationRate').value) || preset.normalFiltrationRate);
    const waterTemp = Math.max(5, Number(el('inputWaterTemp').value) || 28.0);
    const skimAllowance = Math.max(0, Number(el('inputSkimAllowance').value) || 3.0);
    const compactAllowance = Math.max(0, Number(el('inputCompactAllowance').value) || 7.0);

    const activeLayers = [];

    // 1. Anthracite Layer (if enabled in preset)
    let anthResult = null;
    if (preset.layers.anthracite.enabled) {
      const anthConfig = {
        ...preset.layers.anthracite,
        designDepth: Math.max(0.1, Number(el('designDepthAnth').value) || preset.layers.anthracite.designDepth),
        designES: Math.max(0.3, Number(el('designESAnth').value) || preset.layers.anthracite.designES),
        designUC: Math.max(1.1, Number(el('designUCAnth').value) || preset.layers.anthracite.designUC)
      };
      anthResult = M.calculateLayerReplenishment({
        layerConfig: anthConfig,
        filterArea,
        currentDepth: Number(el('currDepthAnth').value),
        currentES: Number(el('currESAnth').value),
        currentUC: Number(el('currUCAnth').value),
        customNewES: Number(el('supplyESAnth').value),
        customNewUC: Number(el('supplyUCAnth').value),
        esTolerancePct: Number(el('tolESAnth').value) || 5.0,
        skimmingAllowancePct: skimAllowance,
        compactionAllowancePct: compactAllowance
      });
      // Attach clean-bed head loss before and after
      anthResult.headLossDesign = M.calculateCleanBedHeadLoss(
        anthConfig,
        anthConfig.designDepth,
        anthConfig.designES,
        anthConfig.designUC,
        filtrationRate,
        waterTemp
      );
      anthResult.headLossCurrent = M.calculateCleanBedHeadLoss(
        anthConfig,
        anthResult.current.depthM,
        anthResult.current.es,
        anthResult.current.uc,
        filtrationRate,
        waterTemp
      );
      activeLayers.push(anthResult);
    }

    // 2. Sand Layer
    const sandConfig = {
      ...preset.layers.sand,
      designDepth: Math.max(0.1, Number(el('designDepthSand').value) || preset.layers.sand.designDepth),
      designES: Math.max(0.2, Number(el('designESSand').value) || preset.layers.sand.designES),
      designUC: Math.max(1.1, Number(el('designUCSand').value) || preset.layers.sand.designUC)
    };
    const sandResult = M.calculateLayerReplenishment({
      layerConfig: sandConfig,
      filterArea,
      currentDepth: Number(el('currDepthSand').value),
      currentES: Number(el('currESSand').value),
      currentUC: Number(el('currUCSand').value),
      customNewES: Number(el('supplyESSand').value),
      customNewUC: Number(el('supplyUCSand').value),
      esTolerancePct: Number(el('tolESSand').value) || 5.0,
      skimmingAllowancePct: skimAllowance,
      compactionAllowancePct: compactAllowance
    });
    sandResult.headLossDesign = M.calculateCleanBedHeadLoss(
      sandConfig,
      sandConfig.designDepth,
      sandConfig.designES,
      sandConfig.designUC,
      filtrationRate,
      waterTemp
    );
    sandResult.headLossCurrent = M.calculateCleanBedHeadLoss(
      sandConfig,
      sandResult.current.depthM,
      sandResult.current.es,
      sandResult.current.uc,
      filtrationRate,
      waterTemp
    );
    activeLayers.push(sandResult);

    const influentNTU = el('inputInfluentNTU') ? Math.max(0.2, Number(el('inputInfluentNTU').value) || 2.0) : 2.0;

    // 3. Evaluate Current Performance & 3 Practical Material Addition Options (Anthracite+Sand vs Sand Only vs Anthracite Only)
    const customPreset = {
      ...preset,
      unitArea: filterArea,
      layers: {
        sand: {
          ...preset.layers.sand,
          enabled: true,
          designDepth: sandConfig.designDepth,
          designES: sandConfig.designES,
          designUC: sandConfig.designUC
        },
        anthracite: {
          ...preset.layers.anthracite,
          enabled: preset.layers.anthracite.enabled,
          designDepth: preset.layers.anthracite.enabled
            ? Math.max(0.1, Number(el('designDepthAnth').value) || preset.layers.anthracite.designDepth)
            : preset.layers.anthracite.designDepth,
          designES: preset.layers.anthracite.enabled
            ? Math.max(0.3, Number(el('designESAnth').value) || preset.layers.anthracite.designES)
            : preset.layers.anthracite.designES,
          designUC: preset.layers.anthracite.enabled
            ? Math.max(1.1, Number(el('designUCAnth').value) || preset.layers.anthracite.designUC)
            : preset.layers.anthracite.designUC
        }
      }
    };

    const strategyEval = M.evaluateMediaAdditionStrategies({
      preset: customPreset,
      filterArea,
      numFilters: preset.numFilters || 14,
      currentSand: {
        depthM: Number(el('currDepthSand').value) || 0,
        es: Number(el('currESSand').value) || sandConfig.designES,
        uc: Number(el('currUCSand').value) || sandConfig.designUC
      },
      currentAnthracite: {
        depthM: preset.layers.anthracite.enabled ? Number(el('currDepthAnth').value) || 0 : 0,
        es: Number(el('currESAnth').value) || preset.layers.anthracite.designES,
        uc: Number(el('currUCAnth').value) || preset.layers.anthracite.designUC
      },
      supplySand: {
        es: Number(el('supplyESSand').value) || sandConfig.designES,
        uc: Number(el('supplyUCSand').value) || sandConfig.designUC
      },
      supplyAnthracite: {
        es: Number(el('supplyESAnth').value) || preset.layers.anthracite.designES,
        uc: Number(el('supplyUCAnth').value) || preset.layers.anthracite.designUC
      },
      filtrationRateMph: filtrationRate,
      tempC: waterTemp,
      influentTurbidityNTU: influentNTU,
      allowancePct: skimAllowance + compactAllowance
    });

    state.lastCalculation = {
      preset: customPreset,
      filterName,
      filterArea,
      filtrationRate,
      influentNTU,
      waterTemp,
      skimAllowance,
      compactAllowance,
      anthResult,
      sandResult,
      activeLayers,
      strategyEval
    };

    renderCurrentDiagnosis();
    renderAdditionStrategies();
    runCustomSimulator();
    renderKpiSummaryGrid();
    renderThreeModesComparison();
    renderCrossSectionSVG();
    renderSieveCurveChart();
    renderMath(el('tab-replenish'));
  }

  // =========================================================================
  // STEP 2: RENDER CURRENT FILTER PERFORMANCE DIAGNOSIS
  // =========================================================================
  function renderCurrentDiagnosis() {
    const calc = state.lastCalculation;
    if (!calc || !calc.strategyEval) return;

    const curr = calc.strategyEval.currentPerformance;
    const des = calc.strategyEval.designPerformance;
    const badge = el('currentStatusBadge');

    if (badge) {
      if (curr.statusLevel === 'good') {
        badge.className = 'badge badge-pass';
        badge.textContent = '✅ สภาพบ่ออยู่ในเกณฑ์มาตรฐาน';
      } else if (curr.statusLevel === 'warning') {
        badge.className = 'badge badge-warn';
        badge.textContent = '⚠️ สมรรถนะเริ่มลดลง ควรวางแผนเติมสารกรอง';
      } else {
        badge.className = 'badge bg-rose-100 text-rose-800 border border-rose-300 font-bold';
        badge.textContent = '🚨 สมรรถนะต่ำกว่าเกณฑ์ เสี่ยงความขุ่นทะลุ ควรเติมสารกรอง';
      }
    }

    const rateDiff = curr.allowableFiltrationRateMph - calc.filtrationRate;
    const rateOk = curr.allowableFiltrationRateMph >= calc.filtrationRate * 0.96;

    const box = el('currentDiagnosisGrid');
    if (!box) return;

    box.innerHTML = `
      <!-- Card 1: % Removal & Turbidity -->
      <div class="p-4 rounded-xl bg-gradient-to-br from-sky-900 to-slate-900 text-white shadow">
        <div class="text-xs text-sky-200 font-semibold flex items-center justify-between">
          <span>ประสิทธิภาพบ่อกรองปัจจุบัน (% Removal)</span>
          <span class="px-1.5 py-0.5 rounded bg-white/10 text-[11px] num-mono">${fmt(curr.operationalLogRemoval, 2)} Log</span>
        </div>
        <div class="flex items-baseline gap-2 mt-1.5">
          <span class="text-3xl font-bold num-mono text-emerald-300">${fmt(curr.operationalRemovalPct, 2)}%</span>
          <span class="text-xs text-sky-200">(Design: ${fmt(des.operationalRemovalPct, 2)}%)</span>
        </div>
        <div class="mt-2 pt-2 border-t border-white/15 text-xs space-y-1 text-sky-100">
          <div class="flex justify-between">
            <span>ความขุ่นน้ำกรองคาดการณ์:</span>
            <strong class="num-mono ${curr.expectedEffluentNTU <= 0.10 ? 'text-emerald-300' : 'text-amber-300'}">${fmt(curr.expectedEffluentNTU, 3)} NTU</strong>
          </div>
          <div class="flex justify-between text-[11px] text-sky-300">
            <span>Clean-Bed Removal เริ่มต้น:</span>
            <span class="num-mono">${fmt(curr.cleanRemovalPct, 1)}% (น้ำเข้า ${fmt(curr.influentTurbidityNTU, 1)} NTU)</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Allowable Filtration Rate -->
      <div class="p-4 rounded-xl ${rateOk ? 'bg-emerald-50/70 border-emerald-300' : 'bg-amber-50/80 border-amber-300'} border-2">
        <div class="text-xs font-bold ${rateOk ? 'text-emerald-950' : 'text-amber-950'}">
          Filtration Rate ที่เหมาะสมของบ่อปัจจุบัน
        </div>
        <div class="flex items-baseline gap-2 mt-1.5">
          <span class="text-3xl font-bold num-mono ${rateOk ? 'text-emerald-800' : 'text-rose-700'}">${fmt(curr.allowableFiltrationRateMph, 2)} m/h</span>
          <span class="text-xs text-slate-600">(เดินจริง ${fmt(calc.filtrationRate, 1)} m/h)</span>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-200/80 text-xs space-y-1 text-slate-700">
          <div class="flex justify-between">
            <span>กำลังผลิตน้ำที่เหมาะสมต่อบ่อ:</span>
            <strong class="num-mono text-slate-900">${fmt(curr.allowableFlowPerFilterM3h, 0)} m³/ชม. (${fmt(curr.allowableFlowPerFilterM3d, 0)} m³/วัน)</strong>
          </div>
          <div class="text-[11px] ${rateOk ? 'text-emerald-800' : 'text-rose-700 font-semibold'}">
            ${
              rateOk
                ? `✅ รองรับอัตราการกรอง ${fmt(calc.filtrationRate, 1)} m/h ได้ตามเกณฑ์`
                : `⚠️ หากยังไม่เติมสารกรอง ควรลดอัตราการกรองลง ${fmt(Math.abs(rateDiff), 1)} m/h เพื่อกันความขุ่นทะลุ`
            }
          </div>
        </div>
      </div>

      <!-- Card 3: Filter Run Time -->
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs font-bold text-slate-700">
          ระยะเวลารอบการกรองปัจจุบัน (Filter Run Time)
        </div>
        <div class="flex items-baseline gap-2 mt-1.5">
          <span class="text-2xl font-bold num-mono text-slate-900">${fmt(curr.governingRunTimeHours, 1)} ชม.</span>
          <span class="text-xs text-slate-500">(Design: ${fmt(des.governingRunTimeHours, 1)} ชม.)</span>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1 text-slate-600">
          <div class="flex justify-between">
            <span>เวลาความขุ่นทะลุ ($t_B$) / ตัน ($t_{HL}$):</span>
            <strong class="num-mono">${fmt(curr.tBreakthroughHours, 1)} / ${fmt(curr.tHeadLossHours, 1)} ชม.</strong>
          </div>
          <div class="flex justify-between text-[11px]">
            <span>ปริมาณน้ำกรองต่อรอบ (UFRV):</span>
            <strong class="num-mono text-sky-900">${fmt(curr.ufrvM3m2, 0)} m³/m²</strong>
          </div>
        </div>
      </div>

      <!-- Card 4: Clean-Bed Head Loss & L/de Capacity -->
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs font-bold text-slate-700">
          Head Loss เริ่มต้น &amp; ความจุชั้นกรอง ($L/d_e$)
        </div>
        <div class="flex items-baseline justify-between mt-1.5">
          <div>
            <span class="text-2xl font-bold num-mono text-sky-900">${fmt(curr.cleanBedHeadLossM, 2)} mWC</span>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-500">ความจุเหลือ:</span>
            <strong class="text-sm font-bold num-mono ${curr.ldCapacityPctOfDesign >= 85 ? 'text-emerald-700' : 'text-rose-700'}">${fmt(curr.ldCapacityPctOfDesign, 0)}%</strong>
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-200 text-xs space-y-1 text-slate-600">
          <div class="flex justify-between">
            <span>ดัชนี $\\sum(L/d_{10})$ ปัจจุบัน vs Design:</span>
            <strong class="num-mono">${fmt(curr.totalLdRatio, 0)} / ${fmt(des.totalLdRatio, 0)}</strong>
          </div>
          <div class="flex justify-between text-[11px]">
            <span>ความลึกรวมปัจจุบัน:</span>
            <strong class="num-mono">${fmt(curr.totalDepthM, 2)} ม. (ทราย ${fmt(curr.sandDepthM, 2)} + แอนทราไซต์ ${fmt(curr.anthraciteDepthM, 2)})</strong>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // STEP 3: RENDER 3 MATERIAL ADDITION STRATEGIES COMPARISON
  //         (1. Anthracite+Sand vs 2. Sand Only vs 3. Anthracite Only)
  // =========================================================================
  function renderAdditionStrategies() {
    const calc = state.lastCalculation;
    if (!calc || !calc.strategyEval) return;

    const ev = calc.strategyEval;
    const banner = el('strategyRecommendationBanner');
    const grid = el('threeAdditionStrategiesGrid');
    if (!banner || !grid) return;

    banner.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div class="font-bold text-base flex items-center gap-2">
            <span>🏆 สรุปคำแนะนำทางวิศวกรรมสำหรับบ่อนี้:</span>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-xs">${ev.recommendedTitleTh}</span>
          </div>
          <span class="text-xs font-semibold text-emerald-800 num-mono">พื้นที่บ่อ ${fmt(ev.filterArea, 1)} m² (รวมเผื่อสั่งซื้อ +${fmt(calc.skimAllowance + calc.compactAllowance, 0)}%)</span>
        </div>
        <p class="text-xs text-emerald-900 leading-relaxed">${ev.recommendationReasonTh}</p>
      </div>
    `;

    const optOrder = ['option1_both', 'option2_sand_only', 'option3_anthracite_only'];
    grid.innerHTML = optOrder
      .map((key) => {
        const opt = ev.options[key];
        const qS = opt.quantities.sand;
        const qA = opt.quantities.anthracite;
        const p = opt.performance;
        const b = opt.resultingBed;
        const isRec = opt.isRecommended;

        const borderClass = isRec
          ? 'border-2 border-emerald-500 bg-emerald-50/20 shadow-md ring-2 ring-emerald-500/20'
          : 'border border-slate-200 bg-white';

        return `
          <div class="p-4 rounded-xl ${borderClass} flex flex-col justify-between">
            <div>
              <!-- Header -->
              <div class="flex items-start justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold uppercase tracking-wider text-sky-800">${opt.badgeTh}</span>
                    ${
                      isRec
                        ? `<span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">⭐ เหมาะสมที่สุด</span>`
                        : ''
                    }
                  </div>
                  <h3 class="text-base font-bold text-slate-900 mt-0.5">${opt.titleTh}</h3>
                </div>
                <div class="text-right">
                  <div class="text-xs text-slate-500">รวมสั่งซื้อต่อบ่อ</div>
                  <div class="text-sm font-bold text-sky-900 num-mono">${fmt(opt.quantities.totalOrderVolumeM3, 1)} m³ (${fmt(opt.quantities.totalOrderMassTons, 1)} ตัน)</div>
                </div>
              </div>

              <!-- Addition Quantities Box -->
              <div class="space-y-2 mb-3">
                <!-- Sand Quantity -->
                <div class="p-2.5 rounded-lg ${qS.depthAddCm > 0.1 ? 'bg-amber-50 border border-amber-300' : 'bg-slate-50 border border-slate-200 opacity-60'} text-xs">
                  <div class="flex items-center justify-between font-bold text-amber-950">
                    <span>🟨 เติมทราย (Silica Sand):</span>
                    <span class="num-mono text-sm">${qS.depthAddCm > 0.1 ? `+${fmt(qS.depthAddCm, 1)} ซม.` : 'ไม่เติม (0 ซม.)'}</span>
                  </div>
                  ${
                    qS.depthAddCm > 0.1
                      ? `<div class="flex justify-between text-[11px] text-amber-900 mt-1 num-mono">
                           <span>สุทธิ ${fmt(qS.netVolumeM3, 1)} m³ | สั่งซื้อ <strong>${fmt(qS.orderVolumeM3, 1)} m³ (${fmt(qS.orderMassTons, 1)} ตัน)</strong></span>
                           <span>ES ${fmt(opt.supplySpec.sand.es, 2)} / UC ${fmt(opt.supplySpec.sand.uc, 2)}</span>
                         </div>`
                      : ''
                  }
                </div>

                <!-- Anthracite Quantity -->
                <div class="p-2.5 rounded-lg ${qA.depthAddCm > 0.1 ? 'bg-slate-800 text-white border border-slate-700' : 'bg-slate-50 border border-slate-200 opacity-60'} text-xs">
                  <div class="flex items-center justify-between font-bold ${qA.depthAddCm > 0.1 ? 'text-sky-300' : 'text-slate-600'}">
                    <span>⬛ เติมแอนทราไซต์ (Anthracite):</span>
                    <span class="num-mono text-sm">${qA.depthAddCm > 0.1 ? `+${fmt(qA.depthAddCm, 1)} ซม.` : 'ไม่เติม (0 ซม.)'}</span>
                  </div>
                  ${
                    qA.depthAddCm > 0.1
                      ? `<div class="flex justify-between text-[11px] text-slate-200 mt-1 num-mono">
                           <span>สุทธิ ${fmt(qA.netVolumeM3, 1)} m³ | สั่งซื้อ <strong>${fmt(qA.orderVolumeM3, 1)} m³ (${fmt(qA.orderMassTons, 1)} ตัน)</strong></span>
                           <span>ES ${fmt(opt.supplySpec.anthracite.es, 2)} / UC ${fmt(opt.supplySpec.anthracite.uc, 2)}</span>
                         </div>`
                      : ''
                  }
                </div>
              </div>

              <!-- Resulting Performance Metrics -->
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 num-mono">
                <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">สมรรถนะบ่อกรองหลังเติม:</div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-600 font-sans">• ประสิทธิภาพบ่อกรอง (% Removal):</span>
                  <strong class="text-sm text-emerald-700">${fmt(p.operationalRemovalPct, 2)}% (${fmt(p.expectedEffluentNTU, 3)} NTU)</strong>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-600 font-sans">• Filtration Rate ที่เหมาะสม:</span>
                  <strong class="text-sm text-sky-900">${fmt(p.allowableFiltrationRateMph, 2)} m/h</strong>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-slate-600 font-sans">• รอบการกรอง (Run Time) / Head Loss:</span>
                  <strong class="text-slate-900">${fmt(p.governingRunTimeHours, 1)} ชม. / ${fmt(p.cleanBedHeadLossM, 2)} mWC</strong>
                </div>
                <div class="flex justify-between items-center pt-1 border-t border-slate-200 text-[11px]">
                  <span class="text-slate-500 font-sans">• ชั้นกรองหลังเติม (ทราย + แอนทราไซต์):</span>
                  <span class="text-slate-800 font-semibold">${fmt(b.sandDepthM, 2)}m + ${fmt(b.anthraciteDepthM, 2)}m (รวม ${fmt(b.totalDepthM, 2)}m)</span>
                </div>
              </div>

              <div class="mt-2.5 text-xs text-slate-600 leading-relaxed">
                ${opt.noteTh}
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-slate-200 flex justify-end no-print">
              <button type="button" class="btn-secondary text-xs w-full justify-center load-strategy-to-sim-btn"
                data-sand-cm="${qS.depthAddCm.toFixed(1)}"
                data-sand-es="${opt.supplySpec.sand ? opt.supplySpec.sand.es.toFixed(2) : calc.sandResult.design.es.toFixed(2)}"
                data-sand-uc="${opt.supplySpec.sand ? opt.supplySpec.sand.uc.toFixed(2) : calc.sandResult.design.uc.toFixed(2)}"
                data-anth-cm="${qA.depthAddCm.toFixed(1)}"
                data-anth-es="${opt.supplySpec.anthracite ? opt.supplySpec.anthracite.es.toFixed(2) : '1.40'}"
                data-anth-uc="${opt.supplySpec.anthracite ? opt.supplySpec.anthracite.uc.toFixed(2) : '1.40'}">
                🧪 นำค่านี้ไปทดสอบปรับแต่งต่อในช่องจำลองด้านล่าง
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.load-strategy-to-sim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        el('simSandUnit').value = 'cm';
        el('lblSimSandVal').textContent = 'ปริมาณที่เติม (ซม.)';
        el('simSandVal').value = btn.getAttribute('data-sand-cm');
        el('simSandES').value = btn.getAttribute('data-sand-es');
        el('simSandUC').value = btn.getAttribute('data-sand-uc');
        el('simSandSkimCm').value = '0.0';

        el('simAnthUnit').value = 'cm';
        el('lblSimAnthVal').textContent = 'ปริมาณที่เติม (ซม.)';
        el('simAnthVal').value = btn.getAttribute('data-anth-cm');
        el('simAnthES').value = btn.getAttribute('data-anth-es');
        el('simAnthUC').value = btn.getAttribute('data-anth-uc');
        el('simAnthSkimCm').value = '0.0';

        runCustomSimulator();
        el('customSimResultContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  // =========================================================================
  // STEP 4: INTERACTIVE "WHAT-IF" CUSTOM ADDITION SIMULATOR
  // =========================================================================
  function runCustomSimulator() {
    const calc = state.lastCalculation;
    if (!calc || !el('customSimResultContainer')) return;

    const sandUnit = el('simSandUnit').value;
    const sandVal = Math.max(0, Number(el('simSandVal').value) || 0);
    const sandES = Math.max(0.2, Number(el('simSandES').value) || 0.95);
    const sandUC = Math.max(1.05, Number(el('simSandUC').value) || 1.40);
    const sandSkimCm = Math.max(0, Number(el('simSandSkimCm').value) || 0);

    const anthUnit = el('simAnthUnit').value;
    const anthVal = Math.max(0, Number(el('simAnthVal').value) || 0);
    const anthES = Math.max(0.3, Number(el('simAnthES').value) || 1.40);
    const anthUC = Math.max(1.05, Number(el('simAnthUC').value) || 1.40);
    const anthSkimCm = Math.max(0, Number(el('simAnthSkimCm').value) || 0);

    const testVf = Math.max(1.0, Number(el('simTestVf').value) || calc.filtrationRate);

    const sim = M.simulateCustomAddition({
      preset: calc.preset,
      filterArea: calc.filterArea,
      currentSand: {
        depthM: Number(el('currDepthSand').value) || 0,
        es: Number(el('currESSand').value) || 0.95,
        uc: Number(el('currUCSand').value) || 1.40
      },
      currentAnthracite: {
        depthM: calc.preset.layers.anthracite.enabled ? Number(el('currDepthAnth').value) || 0 : 0,
        es: Number(el('currESAnth').value) || 1.40,
        uc: Number(el('currUCAnth').value) || 1.40
      },
      addSand: {
        inputMode: sandUnit,
        value: sandVal,
        es: sandES,
        uc: sandUC,
        skimCm: sandSkimCm
      },
      addAnthracite: {
        inputMode: anthUnit,
        value: anthVal,
        es: anthES,
        uc: anthUC,
        skimCm: anthSkimCm
      },
      filtrationRateMph: testVf,
      tempC: calc.waterTemp,
      influentTurbidityNTU: calc.influentNTU
    });

    const bef = sim.beforePerformance;
    const aft = sim.afterPerformance;
    const d = sim.deltas;
    const qS = sim.addedQuantities.sand;
    const qA = sim.addedQuantities.anthracite;
    const b = sim.resultingBed;

    const remSign = d.removalPctDelta >= 0 ? '+' : '';
    const rateSign = d.allowableRateDeltaMph >= 0 ? '+' : '';
    const runSign = d.runTimeDeltaHours >= 0 ? '+' : '';

    el('customSimResultContainer').innerHTML = `
      <div class="p-4 rounded-xl bg-white border border-sky-200 shadow-sm">
        <!-- Top Summary Bar of Custom Addition -->
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 text-xs">
          <div class="font-bold text-slate-900">
            📌 สรุปปริมาณที่คุณระบุจำลอง (ทดสอบเดินระบบที่ Filtration Rate = <span class="num-mono text-sky-800">${fmt(testVf, 1)} m/h</span>):
          </div>
          <div class="flex flex-wrap items-center gap-3 num-mono">
            <span class="px-2.5 py-1 rounded bg-amber-100 text-amber-950 font-semibold">
              🟨 เติมทราย: +${fmt(qS.depthAddCm, 1)} ซม. (${fmt(qS.netVolumeM3, 1)} m³ / ${fmt(qS.netMassTons, 1)} ตัน) [ES ${fmt(qS.supplyES, 2)}, UC ${fmt(qS.supplyUC, 2)}]
            </span>
            <span class="px-2.5 py-1 rounded bg-slate-800 text-sky-200 font-semibold">
              ⬛ เติมแอนทราไซต์: +${fmt(qA.depthAddCm, 1)} ซม. (${fmt(qA.netVolumeM3, 1)} m³ / ${fmt(qA.netMassTons, 1)} ตัน) [ES ${fmt(qA.supplyES, 2)}, UC ${fmt(qA.supplyUC, 2)}]
            </span>
          </div>
        </div>

        <!-- 4 Side-by-Side Before vs After KPIs -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <!-- 1. % Removal -->
          <div class="p-3 rounded-lg bg-sky-50/80 border border-sky-200">
            <div class="font-bold text-sky-950">1. ประสิทธิภาพบ่อกรอง (% Removal)</div>
            <div class="flex items-baseline justify-between mt-1.5 num-mono">
              <div>
                <span class="text-slate-500 font-sans">ก่อนเติม:</span>
                <strong class="text-slate-700">${fmt(bef.operationalRemovalPct, 2)}%</strong>
              </div>
              <div>
                <span class="text-slate-500 font-sans">หลังเติม:</span>
                <strong class="text-lg text-emerald-700">${fmt(aft.operationalRemovalPct, 2)}%</strong>
              </div>
            </div>
            <div class="mt-1.5 pt-1.5 border-t border-sky-200/70 flex justify-between text-[11px] num-mono">
              <span class="text-sky-900">เปลี่ยนแปลง: <strong>${remSign}${fmt(d.removalPctDelta, 2)}%</strong></span>
              <span class="text-slate-700">น้ำกรอง: <strong>${fmt(aft.expectedEffluentNTU, 3)} NTU</strong> (${fmt(aft.operationalLogRemoval, 2)} Log)</span>
            </div>
          </div>

          <!-- 2. Allowable Filtration Rate -->
          <div class="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div class="font-bold text-emerald-950">2. Filtration Rate ที่รองรับได้</div>
            <div class="flex items-baseline justify-between mt-1.5 num-mono">
              <div>
                <span class="text-slate-500 font-sans">ก่อนเติม:</span>
                <strong class="text-slate-700">${fmt(bef.allowableFiltrationRateMph, 2)} m/h</strong>
              </div>
              <div>
                <span class="text-slate-500 font-sans">หลังเติม:</span>
                <strong class="text-lg text-emerald-800">${fmt(aft.allowableFiltrationRateMph, 2)} m/h</strong>
              </div>
            </div>
            <div class="mt-1.5 pt-1.5 border-t border-emerald-200/70 flex justify-between text-[11px] num-mono">
              <span class="text-emerald-900">เพิ่มขึ้น: <strong>${rateSign}${fmt(d.allowableRateDeltaMph, 2)} m/h</strong></span>
              <span class="text-slate-700">ผลิตน้ำ: <strong>${fmt(aft.allowableFlowPerFilterM3d, 0)} m³/วัน</strong></span>
            </div>
          </div>

          <!-- 3. Filter Run Time -->
          <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div class="font-bold text-slate-800">3. ระยะเวลารอบการกรอง (Run Time)</div>
            <div class="flex items-baseline justify-between mt-1.5 num-mono">
              <div>
                <span class="text-slate-500 font-sans">ก่อนเติม:</span>
                <strong class="text-slate-700">${fmt(bef.governingRunTimeHours, 1)} ชม.</strong>
              </div>
              <div>
                <span class="text-slate-500 font-sans">หลังเติม:</span>
                <strong class="text-lg text-sky-900">${fmt(aft.governingRunTimeHours, 1)} ชม.</strong>
              </div>
            </div>
            <div class="mt-1.5 pt-1.5 border-t border-slate-200 flex justify-between text-[11px] num-mono">
              <span class="text-slate-700">$t_B$ ${fmt(aft.tBreakthroughHours, 1)} / $t_{HL}$ ${fmt(aft.tHeadLossHours, 1)} ชม.</span>
              <span class="text-sky-900">(${runSign}${fmt(d.runTimeDeltaHours, 1)} ชม.)</span>
            </div>
          </div>

          <!-- 4. Resulting Composite Media & Head Loss -->
          <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div class="font-bold text-slate-800">4. สเปกผสมหลังเติม &amp; Head Loss</div>
            <div class="mt-1.5 space-y-0.5 text-[11px] num-mono">
              <div class="flex justify-between">
                <span class="text-slate-600 font-sans">ทราย (${fmt(b.sandDepthM, 2)}m):</span>
                <strong>ES ${fmt(b.sandES, 3)} / UC ${fmt(b.sandUC, 2)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600 font-sans">แอนทราไซต์ (${fmt(b.anthraciteDepthM, 2)}m):</span>
                <strong>${b.anthraciteDepthM > 0.01 ? `ES ${fmt(b.anthraciteES, 3)} / UC ${fmt(b.anthraciteUC, 2)}` : 'ไม่มี (0.00m)'}</strong>
              </div>
              <div class="flex justify-between pt-1 border-t border-slate-200">
                <span class="text-slate-600 font-sans">Head Loss / $\\sum(L/d_{10})$:</span>
                <strong class="text-sky-900">${fmt(aft.cleanBedHeadLossM, 2)} mWC / ${fmt(aft.totalLdRatio, 0)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper to get the selected mode's metrics for a layer
  function getSelectedModeMetrics(layerRes, modeKey) {
    if (!layerRes) return null;
    if (modeKey === 'A_topup') {
      return {
        modeLabel: 'แนวทาง (ก-1): เติมสเปก Design (ไม่ปาดของเดิม)',
        depthAddM: layerRes.modeA.topupOnly.depthAddM,
        depthAddCm: layerRes.modeA.topupOnly.depthAddCm,
        depthRemoveM: layerRes.modeA.topupOnly.depthRemoveM,
        depthRemoveCm: layerRes.modeA.topupOnly.depthRemoveCm,
        finalDepthM: layerRes.modeA.topupOnly.finalDepthM,
        supplyES: layerRes.modeA.supplySpec.es,
        supplyUC: layerRes.modeA.supplySpec.uc,
        mixES: layerRes.modeA.topupOnly.mixES,
        mixUC: layerRes.modeA.topupOnly.mixUC,
        mixLdRatio: layerRes.modeA.topupOnly.mixLdRatio,
        netVolumeM3: layerRes.modeA.topupOnly.netVolumeM3,
        orderVolumeM3: layerRes.modeA.topupOnly.orderVolumeM3,
        orderMassTons: layerRes.modeA.topupOnly.orderMassTons,
        numBags: layerRes.modeA.topupOnly.numBags
      };
    } else if (modeKey === 'B') {
      return {
        modeLabel: 'แนวทาง (ข): สเปกพิเศษผสม (Custom Blend)',
        depthAddM: layerRes.modeB.quantities.depthAddM,
        depthAddCm: layerRes.modeB.quantities.depthAddCm,
        depthRemoveM: layerRes.modeB.quantities.depthRemoveM,
        depthRemoveCm: layerRes.modeB.quantities.depthRemoveCm,
        finalDepthM: layerRes.design.depthM,
        supplyES: layerRes.modeB.practicalSpec.es,
        supplyUC: layerRes.modeB.practicalSpec.uc,
        mixES: layerRes.modeB.resultingMix.mixES,
        mixUC: layerRes.modeB.resultingMix.mixUC,
        mixLdRatio: layerRes.modeB.resultingMix.mixLdRatio,
        netVolumeM3: layerRes.modeB.quantities.netVolumeM3,
        orderVolumeM3: layerRes.modeB.quantities.orderVolumeM3,
        orderMassTons: layerRes.modeB.quantities.orderMassTons,
        numBags: layerRes.modeB.quantities.numBags
      };
    } else if (modeKey === 'C') {
      return {
        modeLabel: 'แนวทาง (ค): ปรับความลึกชดเชยตาม L/d_e',
        depthAddM: layerRes.modeC.quantities.depthAddM,
        depthAddCm: layerRes.modeC.quantities.depthAddCm,
        depthRemoveM: 0,
        depthRemoveCm: 0,
        finalDepthM: layerRes.modeC.equivalentTotalDepthM,
        supplyES: layerRes.modeA.supplySpec.es,
        supplyUC: layerRes.modeA.supplySpec.uc,
        mixES: layerRes.modeC.mixES,
        mixUC: layerRes.modeC.mixUC,
        mixLdRatio: layerRes.modeC.achievedLdRatio,
        netVolumeM3: layerRes.modeC.quantities.netVolumeM3,
        orderVolumeM3: layerRes.modeC.quantities.orderVolumeM3,
        orderMassTons: layerRes.modeC.quantities.orderMassTons,
        numBags: layerRes.modeC.quantities.numBags
      };
    } else {
      // Default: 'A_skim'
      return {
        modeLabel: 'แนวทาง (ก-2): เติมสเปก Design + ปาดส่วนเพี้ยนออก',
        depthAddM: layerRes.modeA.recommendedWithSkim.depthAddM,
        depthAddCm: layerRes.modeA.recommendedWithSkim.depthAddCm,
        depthRemoveM: layerRes.modeA.recommendedWithSkim.depthRemoveM,
        depthRemoveCm: layerRes.modeA.recommendedWithSkim.depthRemoveCm,
        finalDepthM: layerRes.modeA.recommendedWithSkim.finalDepthM,
        supplyES: layerRes.modeA.supplySpec.es,
        supplyUC: layerRes.modeA.supplySpec.uc,
        mixES: layerRes.modeA.recommendedWithSkim.mixES,
        mixUC: layerRes.modeA.recommendedWithSkim.mixUC,
        mixLdRatio: layerRes.modeA.recommendedWithSkim.mixLdRatio,
        netVolumeM3: layerRes.modeA.recommendedWithSkim.netVolumeM3,
        orderVolumeM3: layerRes.modeA.recommendedWithSkim.orderVolumeM3,
        orderMassTons: layerRes.modeA.recommendedWithSkim.orderMassTons,
        numBags: layerRes.modeA.recommendedWithSkim.numBags
      };
    }
  }

  function renderKpiSummaryGrid() {
    const calc = state.lastCalculation;
    if (!calc) return;

    const modeKey = el('selectActiveModeForSummary').value;
    let totalDesignLd = 0;
    let totalCurrLd = 0;
    let totalAfterLd = 0;

    let totalDesignDepth = 0;
    let totalCurrDepth = 0;
    let totalAfterDepth = 0;

    let totalHeadLossDesign = 0;
    let totalHeadLossCurr = 0;

    let totalOrderM3 = 0;
    let totalOrderTons = 0;

    calc.activeLayers.forEach((lr) => {
      const sel = getSelectedModeMetrics(lr, modeKey);
      totalDesignLd += lr.design.ldRatio;
      totalCurrLd += lr.current.ldRatio;
      totalAfterLd += sel.mixLdRatio;

      totalDesignDepth += lr.design.depthM;
      totalCurrDepth += lr.current.depthM;
      totalAfterDepth += sel.finalDepthM;

      totalHeadLossDesign += lr.headLossDesign.totalHeadLoss;
      totalHeadLossCurr += lr.headLossCurrent.totalHeadLoss;

      totalOrderM3 += sel.orderVolumeM3;
      totalOrderTons += sel.orderMassTons;
    });

    const ldPassCurr = totalCurrLd >= 1000;
    const ldPassAfter = totalAfterLd >= 1000;

    el('filterKpiSummaryGrid').innerHTML = `
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-semibold">ความลึกรวมของชั้นสารกรอง ($L_{\\text{total}}$)</div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <span class="text-xs text-slate-500">ปัจจุบัน:</span>
            <span class="text-lg font-bold text-rose-700 num-mono">${fmt(totalCurrDepth, 2)} m</span>
          </div>
          <div>
            <span class="text-xs text-slate-500">หลังเติม:</span>
            <span class="text-lg font-bold text-emerald-700 num-mono">${fmt(totalAfterDepth, 2)} m</span>
          </div>
        </div>
        <div class="text-xs text-slate-500 mt-1">Design มาตรฐาน: <strong class="num-mono">${fmt(totalDesignDepth, 2)} m</strong> (ขาดไป ${fmt((totalDesignDepth - totalCurrDepth) * 100, 1)} ซม.)</div>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-semibold">ดัชนีสมรรถนะการกรองรวม $\\sum (L/d_{10})$</div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <span class="text-xs text-slate-500">ปัจจุบัน:</span>
            <span class="text-lg font-bold ${ldPassCurr ? 'text-amber-700' : 'text-rose-700'} num-mono">${fmt(totalCurrLd, 0)}</span>
          </div>
          <div>
            <span class="text-xs text-slate-500">หลังเติม:</span>
            <span class="text-lg font-bold ${ldPassAfter ? 'text-emerald-700' : 'text-amber-700'} num-mono">${fmt(totalAfterLd, 0)}</span>
          </div>
        </div>
        <div class="text-xs text-slate-500 mt-1">ค่า Design: <strong class="num-mono">${fmt(totalDesignLd, 0)}</strong> (เกณฑ์ Kawamura $\\ge 1,000$)</div>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-semibold">Clean-Bed Head Loss (สมการ Ergun)</div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <span class="text-xs text-slate-500">ปัจจุบัน:</span>
            <span class="text-lg font-bold text-slate-800 num-mono">${fmt(totalHeadLossCurr, 2)} mWC</span>
          </div>
          <div>
            <span class="text-xs text-slate-500">ตาม Design:</span>
            <span class="text-lg font-bold text-sky-800 num-mono">${fmt(totalHeadLossDesign, 2)} mWC</span>
          </div>
        </div>
        <div class="text-xs text-slate-500 mt-1">ที่อัตราการกรอง $v_F$ = <strong class="num-mono">${fmt(calc.filtrationRate, 1)} m/h</strong>, อุณหภูมิ ${fmt(calc.waterTemp, 1)} °C</div>
      </div>

      <div class="p-3.5 rounded-xl bg-sky-50 border border-sky-200">
        <div class="text-xs text-sky-900 font-semibold">ปริมาณสารกรองที่ต้องจัดซื้อรวมบ่อนี้</div>
        <div class="flex items-baseline justify-between mt-1">
          <div>
            <span class="text-xl font-bold text-sky-900 num-mono">${fmt(totalOrderM3, 1)} $\\text{m}^3$</span>
          </div>
          <div>
            <span class="text-lg font-bold text-emerald-800 num-mono">${fmt(totalOrderTons, 1)} ตัน</span>
          </div>
        </div>
        <div class="text-xs text-sky-800 mt-1">รวมเผื่อ Skimming ${fmt(calc.skimAllowance, 1)}% + ยุบตัว/สูญเสีย ${fmt(calc.compactAllowance, 1)}%</div>
      </div>
    `;
  }

  function renderThreeModesComparison() {
    const calc = state.lastCalculation;
    if (!calc) return;

    const container = el('threeModesResultContainer');

    container.innerHTML = calc.activeLayers
      .map((lr) => {
        const isAnth = lr.layerType === 'anthracite';
        const pillClass = isAnth ? 'layer-pill-anthracite' : 'layer-pill-sand';
        const mA = lr.modeA;
        const mB = lr.modeB;
        const mC = lr.modeC;

        const topupBadge = mA.topupOnly.withinSpec
          ? `<span class="badge badge-pass">ผ่านเกณฑ์ ES/UC</span>`
          : `<span class="badge badge-warn">ES/UC เฉลี่ยยังอยู่นอกกรอบ ±${el(isAnth ? 'tolESAnth' : 'tolESSand').value}%</span>`;

        const skimAlert = mA.recommendedWithSkim.requiresSkimming
          ? `<div class="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950">
               <strong>💡 คำแนะนำเชิงวิชาการ (Skim &amp; Replenish):</strong> หากเติมทับอย่างเดียว ค่าผสมจะได้ $ES_{\\text{mix}} = ${fmt(mA.topupOnly.mixES, 3)}$ มม., $UC_{\\text{mix}} = ${fmt(mA.topupOnly.mixUC, 2)}$
               หากต้องการดึงค่าเฉลี่ยกลับมาในกรอบ Design แนะนำให้ <strong>ปาด/ลอกสารกรองเก่าออก ${fmt(mA.recommendedWithSkim.depthRemoveCm, 1)} ซม.</strong> แล้วเติมสารกรองใหม่รวม <strong>${fmt(mA.recommendedWithSkim.depthAddCm, 1)} ซม.</strong> (${fmt(mA.recommendedWithSkim.orderVolumeM3, 1)} m³ / ${fmt(mA.recommendedWithSkim.orderMassTons, 1)} ตัน)
             </div>`
          : `<div class="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
               <strong>✅ เติมทับได้ทันทีโดยไม่ต้องลอกสารกรองเดิม:</strong> การเติมสารกรองสเปก Design ความหนา ${fmt(mA.topupOnly.depthAddCm, 1)} ซม. ทำให้ค่า $ES_{\\text{mix}} = ${fmt(mA.topupOnly.mixES, 3)}$ มม. และ $UC_{\\text{mix}} = ${fmt(mA.topupOnly.mixUC, 2)}$ อยู่ในเกณฑ์มาตรฐาน
             </div>`;

        return `
          <div class="p-4 rounded-xl border border-slate-300 bg-slate-50/50">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
              <div class="flex items-center gap-2">
                <span class="${pillClass}">${lr.layerNameEn}</span>
                <h3 class="text-base font-bold text-slate-900">${lr.layerNameTh}</h3>
              </div>
              <div class="text-xs text-slate-600 num-mono">
                <strong>Design:</strong> L = ${fmt(lr.design.depthM, 2)} m, ES = ${fmt(lr.design.es, 2)} mm, UC = ${fmt(lr.design.uc, 2)} ($L/d_{10}$ = ${fmt(lr.design.ldRatio, 0)})
                &nbsp;|&nbsp;
                <strong>ปัจจุบัน:</strong> L = ${fmt(lr.current.depthM, 2)} m (ขาด ${fmt(lr.current.missingDepthCm, 1)} ซม.), ES = ${fmt(lr.current.es, 2)} mm, UC = ${fmt(lr.current.uc, 2)} ($L/d_{10}$ = ${fmt(lr.current.ldRatio, 0)})
              </div>
            </div>

            <!-- 3 Approaches Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

              <!-- MODE A CARD -->
              <div class="mode-card">
                <div class="mode-card-header">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-sky-800">แนวทางที่ 1 (ก)</span>
                    <h4 class="text-sm font-bold text-slate-900 mt-0.5">เติมสารกรองสเปก Design ให้ได้ระดับความลึกเดิม</h4>
                  </div>
                  ${topupBadge}
                </div>
                <p class="text-xs text-slate-600 mb-3">
                  ใช้สารกรองใหม่สเปกมาตรฐาน ($ES = ${fmt(mA.supplySpec.es, 2)}$ มม., $UC = ${fmt(mA.supplySpec.uc, 2)}$) เติมให้ได้ระดับ $L_{\\text{design}} = ${fmt(lr.design.depthM, 2)}$ ม.
                </p>

                <div class="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 num-mono">
                  <div class="flex justify-between">
                    <span class="text-slate-600">กรณีเติมทับอย่างเดียว (ไม่ปาดออก):</span>
                    <strong class="text-slate-900">เติม +${fmt(mA.topupOnly.depthAddCm, 1)} ซม.</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• ปริมาตรสุทธิ / สั่งซื้อ (+${fmt(lr.allowances.skimmingAllowancePct + lr.allowances.compactionAllowancePct, 0)}%):</span>
                    <strong class="text-sky-900">${fmt(mA.topupOnly.netVolumeM3, 1)} / ${fmt(mA.topupOnly.orderVolumeM3, 1)} m³</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• น้ำหนักสั่งซื้อรวม (ตัน / ถุงตัน):</span>
                    <strong class="text-emerald-800">${fmt(mA.topupOnly.orderMassTons, 2)} ตัน (${mA.topupOnly.numBags} ถุง)</strong>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-slate-200">
                    <span class="text-slate-600">• ค่าผสมหลังเติม ($ES_{\\text{mix}}$ / $UC_{\\text{mix}}$):</span>
                    <strong>${fmt(mA.topupOnly.mixES, 3)} มม. / ${fmt(mA.topupOnly.mixUC, 2)}</strong>
                  </div>
                </div>
                ${skimAlert}
              </div>

              <!-- MODE B CARD -->
              <div class="mode-card">
                <div class="mode-card-header">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-teal-800">แนวทางที่ 2 (ข)</span>
                    <h4 class="text-sm font-bold text-slate-900 mt-0.5">เลือกสเปกสารกรองใหม่เพื่อผสม (Custom Blend)</h4>
                  </div>
                  <span class="badge ${mB.practicalWithinSpec ? 'badge-pass' : 'badge-info'}">
                    ${mB.practicalWithinSpec ? 'ดึงเข้าสเปกได้' : 'เข้าใกล้ Design ที่สุด'}
                  </span>
                </div>
                <p class="text-xs text-slate-600 mb-3">
                  คำนวณย้อนกลับหาค่า $(ES_{\\text{new}}, UC_{\\text{new}})$ ของสารกรองที่จะสั่งมาเติมความหนา ${fmt(mB.quantities.depthAddCm, 1)} ซม. เพื่อถ่วงดุลกับของเดิมในบ่อ
                </p>

                <div class="space-y-1.5 text-xs bg-teal-50/60 p-2.5 rounded-lg border border-teal-200 num-mono">
                  <div class="flex justify-between">
                    <span class="text-teal-950 font-semibold">สเปกสารกรองใหม่ที่แนะนำให้สั่งซื้อ:</span>
                    <strong class="text-teal-900">ES = ${fmt(mB.practicalSpec.es, 2)} มม., UC = ${fmt(mB.practicalSpec.uc, 2)}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• ความลึกที่เติมเพิ่ม:</span>
                    <strong>+${fmt(mB.quantities.depthAddCm, 1)} ซม. (ได้ระดับ ${fmt(lr.design.depthM, 2)} ม.)</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• ปริมาตรสุทธิ / สั่งซื้อรวมเผื่อ:</span>
                    <strong class="text-sky-900">${fmt(mB.quantities.netVolumeM3, 1)} / ${fmt(mB.quantities.orderVolumeM3, 1)} m³</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• น้ำหนักสั่งซื้อรวม:</span>
                    <strong class="text-emerald-800">${fmt(mB.quantities.orderMassTons, 2)} ตัน (${mB.quantities.numBags} ถุง)</strong>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-teal-200">
                    <span class="text-slate-600">• ผลลัพธ์รวมในบ่อ ($ES_{\\text{mix}}$ / $UC_{\\text{mix}}$):</span>
                    <strong>${fmt(mB.resultingMix.mixES, 3)} มม. / ${fmt(mB.resultingMix.mixUC, 2)}</strong>
                  </div>
                </div>
                <div class="mt-2 p-2.5 rounded-lg bg-slate-100 text-xs text-slate-700">
                  ${mB.reasonTh}
                </div>
              </div>

              <!-- MODE C CARD -->
              <div class="mode-card">
                <div class="mode-card-header">
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-amber-800">แนวทางที่ 3 (ค)</span>
                    <h4 class="text-sm font-bold text-slate-900 mt-0.5">ปรับระดับความลึกชดเชยตามสัดส่วน $L/d_e$</h4>
                  </div>
                  <span class="badge ${mC.exceedsDesignDepthWarning ? 'badge-warn' : 'badge-pass'}">
                    $L/d_{10}$ = ${fmt(mC.achievedLdRatio, 0)}
                  </span>
                </div>
                <p class="text-xs text-slate-600 mb-3">
                  ไม่ลอกสารกรองเก่าออก แต่คำนวณความลึกที่ต้องเติมเพื่อให้ค่าดัชนีการกรอง $L/d_e$ เทียบเท่า Design เดิม (${fmt(mC.designLdRatio, 0)})
                </p>

                <div class="space-y-1.5 text-xs bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 num-mono">
                  <div class="flex justify-between">
                    <span class="text-amber-950 font-semibold">ความลึกรวมที่ต้องการ ($L_{\\text{eq}}$):</span>
                    <strong class="text-amber-900">${fmt(mC.equivalentTotalDepthM, 2)} ม. (${mC.depthDiffFromDesignCm >= 0 ? '+' : ''}${fmt(mC.depthDiffFromDesignCm, 1)} ซม. จาก Design)</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• ความลึกสารกรองที่ต้องเติมเพิ่ม:</span>
                    <strong>+${fmt(mC.quantities.depthAddCm, 1)} ซม.</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• ปริมาตรสุทธิ / สั่งซื้อรวมเผื่อ:</span>
                    <strong class="text-sky-900">${fmt(mC.quantities.netVolumeM3, 1)} / ${fmt(mC.quantities.orderVolumeM3, 1)} m³</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-600">• น้ำหนักสั่งซื้อรวม:</span>
                    <strong class="text-emerald-800">${fmt(mC.quantities.orderMassTons, 2)} ตัน (${mC.quantities.numBags} ถุง)</strong>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-amber-200">
                    <span class="text-slate-600">• ค่าผสมหลังเติม ($ES_{\\text{mix}}$ / $UC_{\\text{mix}}$):</span>
                    <strong>${fmt(mC.mixES, 3)} มม. / ${fmt(mC.mixUC, 2)}</strong>
                  </div>
                </div>
                <div class="mt-2 p-2.5 rounded-lg bg-slate-100 text-xs text-slate-700">
                  ปัจจุบันค่า $L/d_{10}$ ลดลงเหลือ <strong>${fmt(mC.currentLdRatio, 0)}</strong> (สูญเสียความสามารถในการกรองไป ${fmt(mC.ldDeficitPercent, 1)}%) การเติมเพิ่ม ${fmt(mC.quantities.depthAddCm, 1)} ซม. จะชดเชยทั้งความลึกที่หายไปและขนาด $ES$ ที่โตขึ้น
                </div>
              </div>

            </div>
          </div>
        `;
      })
      .join('');
  }

  // =========================================================================
  // 2D FILTER BED CROSS-SECTION SVG VISUALIZER
  // =========================================================================
  function renderCrossSectionSVG() {
    const calc = state.lastCalculation;
    if (!calc) return;

    const modeKey = el('selectActiveModeForSummary').value;
    const preset = calc.preset;
    const hasGravel = preset.gravel.hasGravel;
    const gravelDepth = hasGravel ? preset.gravel.depth : 0;

    const sandSel = getSelectedModeMetrics(calc.sandResult, modeKey);
    const anthSel = calc.anthResult ? getSelectedModeMetrics(calc.anthResult, modeKey) : null;

    const totalDesignMedia =
      calc.sandResult.design.depthM + (calc.anthResult ? calc.anthResult.design.depthM : 0);
    const maxScaleM = Math.max(2.2, totalDesignMedia + gravelDepth + preset.troughHeightAboveMedia + 0.25);

    const svgW = 440;
    const svgH = 340;
    const padTop = 28;
    const padBottom = 32;
    const drawH = svgH - padTop - padBottom;

    function mToPx(m) {
      return (m / maxScaleM) * drawH;
    }

    const baseY = svgH - padBottom; // Underdrain floor level

    // Column 1: Design Bed (x: 45 to 150)
    // Column 2: Current Depleted Bed (x: 175 to 280)
    // Column 3: Replenished Bed (x: 305 to 410)
    const cols = [
      { title: '1. ตาม Design', x: 45, w: 105 },
      { title: '2. สภาพปัจจุบัน', x: 175, w: 105 },
      { title: '3. หลังเติมปรับปรุง', x: 305, w: 105 }
    ];

    function buildColumnRects(colIndex) {
      const col = cols[colIndex];
      let currY = baseY;
      let rectsHtml = '';

      // Gravel layer
      if (gravelDepth > 0) {
        const gh = mToPx(gravelDepth);
        currY -= gh;
        rectsHtml += `
          <rect x="${col.x}" y="${currY}" width="${col.w}" height="${gh}" fill="#78716c" stroke="#44403c" stroke-width="1"/>
          <text x="${col.x + col.w / 2}" y="${currY + gh / 2 + 4}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="600">Gravel ${fmt(gravelDepth, 2)}m</text>
        `;
      }

      if (colIndex === 0) {
        // DESIGN
        const sh = mToPx(calc.sandResult.design.depthM);
        currY -= sh;
        rectsHtml += `
          <rect x="${col.x}" y="${currY}" width="${col.w}" height="${sh}" fill="#fde047" stroke="#ca8a04" stroke-width="1.2"/>
          <text x="${col.x + col.w / 2}" y="${currY + sh / 2}" text-anchor="middle" fill="#713f12" font-size="10" font-weight="700">Sand ${fmt(calc.sandResult.design.depthM, 2)}m</text>
          <text x="${col.x + col.w / 2}" y="${currY + sh / 2 + 12}" text-anchor="middle" fill="#854d0e" font-size="9">ES ${fmt(calc.sandResult.design.es, 2)}</text>
        `;

        if (calc.anthResult) {
          const ah = mToPx(calc.anthResult.design.depthM);
          currY -= ah;
          rectsHtml += `
            <rect x="${col.x}" y="${currY}" width="${col.w}" height="${ah}" fill="#334155" stroke="#0f172a" stroke-width="1.2"/>
            <text x="${col.x + col.w / 2}" y="${currY + ah / 2}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">Anthracite ${fmt(calc.anthResult.design.depthM, 2)}m</text>
            <text x="${col.x + col.w / 2}" y="${currY + ah / 2 + 12}" text-anchor="middle" fill="#cbd5e1" font-size="9">ES ${fmt(calc.anthResult.design.es, 2)}</text>
          `;
        }
      } else if (colIndex === 1) {
        // CURRENT
        const sh = mToPx(calc.sandResult.current.depthM);
        currY -= sh;
        rectsHtml += `
          <rect x="${col.x}" y="${currY}" width="${col.w}" height="${sh}" fill="#fef08a" stroke="#d97706" stroke-width="1.2"/>
          <text x="${col.x + col.w / 2}" y="${currY + sh / 2}" text-anchor="middle" fill="#713f12" font-size="10" font-weight="700">Sand ${fmt(calc.sandResult.current.depthM, 2)}m</text>
          <text x="${col.x + col.w / 2}" y="${currY + sh / 2 + 12}" text-anchor="middle" fill="#9a3412" font-size="9">ES ${fmt(calc.sandResult.current.es, 2)}</text>
        `;

        if (calc.anthResult) {
          const ah = mToPx(calc.anthResult.current.depthM);
          currY -= ah;
          rectsHtml += `
            <rect x="${col.x}" y="${currY}" width="${col.w}" height="${ah}" fill="#475569" stroke="#1e293b" stroke-width="1.2"/>
            <text x="${col.x + col.w / 2}" y="${currY + ah / 2}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">Anth ${fmt(calc.anthResult.current.depthM, 2)}m</text>
            <text x="${col.x + col.w / 2}" y="${currY + ah / 2 + 12}" text-anchor="middle" fill="#fca5a5" font-size="9">ES ${fmt(calc.anthResult.current.es, 2)}</text>
          `;
        }
      } else {
        // REPLENISHED (Old kept + New added)
        const sandOldKept = Math.max(0, calc.sandResult.current.depthM - sandSel.depthRemoveM);
        const sandNewAdd = sandSel.depthAddM;

        const shOld = mToPx(sandOldKept);
        currY -= shOld;
        if (shOld > 2) {
          rectsHtml += `
            <rect x="${col.x}" y="${currY}" width="${col.w}" height="${shOld}" fill="#fef08a" stroke="#ca8a04" stroke-width="1"/>
          `;
        }
        const shNew = mToPx(sandNewAdd);
        currY -= shNew;
        if (shNew > 2) {
          rectsHtml += `
            <rect x="${col.x}" y="${currY}" width="${col.w}" height="${shNew}" fill="#facc15" stroke="#15803d" stroke-width="1.5" stroke-dasharray="3,1"/>
          `;
        }
        const totalSh = shOld + shNew;
        rectsHtml += `
          <text x="${col.x + col.w / 2}" y="${currY + totalSh / 2}" text-anchor="middle" fill="#713f12" font-size="10" font-weight="700">Sand +${fmt(sandSel.depthAddCm, 0)}cm</text>
          <text x="${col.x + col.w / 2}" y="${currY + totalSh / 2 + 12}" text-anchor="middle" fill="#14532d" font-size="9">Mix ES ${fmt(sandSel.mixES, 2)}</text>
        `;

        if (calc.anthResult && anthSel) {
          const anthOldKept = Math.max(0, calc.anthResult.current.depthM - anthSel.depthRemoveM);
          const anthNewAdd = anthSel.depthAddM;

          const ahOld = mToPx(anthOldKept);
          currY -= ahOld;
          if (ahOld > 2) {
            rectsHtml += `
              <rect x="${col.x}" y="${currY}" width="${col.w}" height="${ahOld}" fill="#475569" stroke="#1e293b" stroke-width="1"/>
            `;
          }
          const ahNew = mToPx(anthNewAdd);
          currY -= ahNew;
          if (ahNew > 2) {
            rectsHtml += `
              <rect x="${col.x}" y="${currY}" width="${col.w}" height="${ahNew}" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3,1"/>
            `;
          }
          const totalAh = ahOld + ahNew;
          rectsHtml += `
            <text x="${col.x + col.w / 2}" y="${currY + totalAh / 2}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">Anth +${fmt(anthSel.depthAddCm, 0)}cm</text>
            <text x="${col.x + col.w / 2}" y="${currY + totalAh / 2 + 12}" text-anchor="middle" fill="#7dd3fc" font-size="9">Mix ES ${fmt(anthSel.mixES, 2)}</text>
          `;
        }
      }

      return rectsHtml;
    }

    const designTopY = baseY - mToPx(gravelDepth + totalDesignMedia);
    const troughY = designTopY - mToPx(preset.troughHeightAboveMedia);

    el('filterCrossSectionSvgContainer').innerHTML = `
      <svg viewBox="0 0 ${svgW} ${svgH}" class="w-full max-w-md border border-slate-200 rounded-lg bg-gradient-to-b from-sky-50 to-slate-100">
        <!-- Backwash Trough / Weir Line -->
        <line x1="25" y1="${troughY}" x2="${svgW - 15}" y2="${troughY}" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="30" y="${troughY - 5}" fill="#0369a1" font-size="9.5" font-weight="700">ระดับขอบรางน้ำล้างย้อน (Backwash Weir +${fmt(preset.troughHeightAboveMedia, 2)} m)</text>

        <!-- Design Surface Reference Line -->
        <line x1="25" y1="${designTopY}" x2="${svgW - 15}" y2="${designTopY}" stroke="#15803d" stroke-width="1.2" stroke-dasharray="3,3" />
        <text x="${svgW - 18}" y="${designTopY - 4}" text-anchor="end" fill="#15803d" font-size="9" font-weight="700">ระดับผิวสารกรอง Design (${fmt(totalDesignMedia, 2)}m)</text>

        <!-- Columns -->
        ${buildColumnRects(0)}
        ${buildColumnRects(1)}
        ${buildColumnRects(2)}

        <!-- Underdrain Floor Line -->
        <line x1="20" y1="${baseY}" x2="${svgW - 15}" y2="${baseY}" stroke="#0f172a" stroke-width="2.5" />
        <text x="${svgW / 2}" y="${baseY + 14}" text-anchor="middle" fill="#334155" font-size="10" font-weight="700">พื้นหัวกรอง (Underdrain Nozzle Floor EL 0.00 m)</text>

        <!-- Column Headers -->
        ${cols
          .map(
            (c) =>
              `<text x="${c.x + c.w / 2}" y="18" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700">${c.title}</text>`
          )
          .join('')}
      </svg>
    `;
  }

  // =========================================================================
  // LOG-NORMAL SIEVE ANALYSIS CHART (CHART.JS)
  // =========================================================================
  function renderSieveCurveChart() {
    const calc = state.lastCalculation;
    if (!calc || typeof window.Chart === 'undefined') return;

    const selectedLayerType = el('selectChartLayer').value;
    const layerRes =
      selectedLayerType === 'anthracite' && calc.anthResult ? calc.anthResult : calc.sandResult;
    const modeKey = el('selectActiveModeForSummary').value;
    const sel = getSelectedModeMetrics(layerRes, modeKey);

    // Generate diameter grid from 0.25 mm to 3.8 mm
    const diameters = [];
    for (let d = 0.30; d <= 3.60; d += 0.05) {
      diameters.push(Number(d.toFixed(2)));
    }

    const designCurve = diameters.map(
      (d) => M.logNormalPassing(d, layerRes.design.es, layerRes.design.uc) * 100
    );
    const currentCurve = diameters.map(
      (d) => M.logNormalPassing(d, layerRes.current.es, layerRes.current.uc) * 100
    );
    const newSupplyCurve = diameters.map(
      (d) => M.logNormalPassing(d, sel.supplyES, sel.supplyUC) * 100
    );
    const compositeMixCurve = diameters.map(
      (d) => M.logNormalPassing(d, sel.mixES, sel.mixUC) * 100
    );

    const ctx = el('sieveCurveCanvas').getContext('2d');
    if (state.sieveChartInstance) {
      state.sieveChartInstance.destroy();
    }

    state.sieveChartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: diameters,
        datasets: [
          {
            label: `Design (ES=${fmt(layerRes.design.es, 2)}, UC=${fmt(layerRes.design.uc, 2)})`,
            data: designCurve,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25
          },
          {
            label: `สภาพปัจจุบันในบ่อ (ES=${fmt(layerRes.current.es, 2)}, UC=${fmt(layerRes.current.uc, 2)})`,
            data: currentCurve,
            borderColor: '#dc2626',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.25
          },
          {
            label: `สารกรองใหม่ที่เติม (ES=${fmt(sel.supplyES, 2)}, UC=${fmt(sel.supplyUC, 2)})`,
            data: newSupplyCurve,
            borderColor: '#d97706',
            borderDash: [3, 3],
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.25
          },
          {
            label: `ผลลัพธ์รวมหลังเติม (ES_mix=${fmt(sel.mixES, 3)}, UC_mix=${fmt(sel.mixUC, 2)})`,
            data: compositeMixCurve,
            borderColor: '#16a34a',
            borderWidth: 3,
            pointRadius: 0,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Sarabun', size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => `ขนาดตะแกรง d = ${items[0].label} มม.`,
              label: (item) => `${item.dataset.label}: ผ่านสะสม ${item.formattedValue}%`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'ขนาดเม็ดสารกรอง / ขนาดช่องตะแกรง Sieve Opening d (มม.)',
              font: { family: 'Sarabun', weight: 'bold', size: 12 }
            }
          },
          y: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'เปอร์เซ็นต์ผ่านตะแกรงสะสม (% Passing by Weight)',
              font: { family: 'Sarabun', weight: 'bold', size: 12 }
            }
          }
        }
      }
    });
  }

  // =========================================================================
  // TAB 2: REVERSE DESIGN & FILTRATION RATE SOLVER
  // =========================================================================
  function runReverseSolver() {
    const role = el('revLayerRole').value;
    const mediaType = role.includes('anthracite') ? 'anthracite' : 'sand';
    const depthM = Number(el('revDepthM').value) || 1.2;
    const uc = Number(el('revUC').value) || 1.4;
    const vF = Number(el('revFiltrationRate').value) || 11.0;
    const availHead = Number(el('revAvailHead').value) || 1.8;
    const vBW = Number(el('revBackwashRate').value) || 55.0;
    const tempC = Number(el('inputWaterTemp').value) || 28.0;

    const res = M.solveOptimalESForConditions({
      mediaType,
      layerRole: role,
      depthM,
      uc,
      filtrationRateMph: vF,
      availableHeadM: availHead,
      maxBackwashRateMph: vBW,
      tempC
    });

    el('reverseSolverResultBox').innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-sky-900 text-white shadow">
          <div class="text-xs text-sky-200 font-semibold">ขนาดประสิทธิผลที่เหมาะสมที่สุด ($ES = d_{10}$)</div>
          <div class="text-3xl font-bold num-mono mt-1">${fmt(res.recommended.es, 2)} มม.</div>
          <div class="text-xs text-sky-200 mt-1">ช่วงที่แนะนำ: <strong class="num-mono text-white">${fmt(res.recommended.esRangeMin, 2)} – ${fmt(res.recommended.esRangeMax, 2)} มม.</strong></div>
        </div>

        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500 font-semibold">ขนาดเม็ดกระจายตัว ($d_{50}, d_{60}, d_{90}$) ที่ $UC = ${fmt(uc, 2)}$</div>
          <div class="text-sm font-bold text-slate-900 num-mono mt-1.5">
            $d_{50}$ = ${fmt(res.recommended.d50, 2)} มม. | $d_{60}$ = ${fmt(res.recommended.d60, 2)} มม.
          </div>
          <div class="text-xs text-slate-600 mt-1 num-mono">
            $d_{90}$ (สำหรับคำนวณล้างย้อน) = <strong>${fmt(res.recommended.d90, 2)} มม.</strong>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500 font-semibold">ดัชนี $L/d_{10}$ &amp; Clean-Bed Head Loss</div>
          <div class="text-lg font-bold text-emerald-700 num-mono mt-1">
            $L/d_{10}$ = ${fmt(res.recommended.ldRatio, 0)}
          </div>
          <div class="text-xs text-slate-600 mt-1 num-mono">
            Head Loss เริ่มต้น $h_{L,0}$ = <strong>${fmt(res.recommended.cleanBedHeadLossM, 3)} mWC</strong>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div class="text-xs text-slate-500 font-semibold">ความเร็วล้างย้อนต่ำสุด $V_{mf}(d_{60})$</div>
          <div class="text-lg font-bold text-sky-800 num-mono mt-1">
            ${fmt(res.recommended.vMfD60Mph, 1)} m/h
          </div>
          <div class="text-xs text-slate-600 mt-1">
            ขอบเขตบนของ $ES$ ที่ปั๊มล้างย้อน (${fmt(vBW, 0)} m/h) รับได้: <strong>$\le$ ${fmt(res.criteriaBreakdown.esMaxBackwash, 2)} มม.</strong>
          </div>
        </div>
      </div>

      <div class="mt-3 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
        <strong>การประเมิน Filtration Rate (${fmt(vF, 1)} m/h):</strong> ${res.filtrationRateCheck.assessmentTh}
      </div>
    `;

    // Render MWH Optimization Chart (t_B vs t_HL)
    if (typeof window.Chart !== 'undefined') {
      const ctx = el('reverseOptChartCanvas').getContext('2d');
      if (state.reverseChartInstance) {
        state.reverseChartInstance.destroy();
      }

      const labels = res.curvePoints.map((pt) => pt.es);
      const tBData = res.curvePoints.map((pt) => pt.tBreakthrough);
      const tHLData = res.curvePoints.map((pt) => pt.tHeadLoss);

      state.reverseChartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'เวลาจนความขุ่นทะลุ (Time to Breakthrough t_B, ชม.)',
              data: tBData,
              borderColor: '#0284c7',
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0.25
            },
            {
              label: 'เวลาจน Head Loss เต็มพิกัด (Time to Limiting Head t_HL, ชม.)',
              data: tHLData,
              borderColor: '#ea580c',
              borderDash: [6, 4],
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { font: { family: 'Sarabun', size: 11 } } },
            tooltip: {
              callbacks: {
                title: (items) => `ขนาด ES (d10) = ${items[0].label} มม.`,
                afterBody: (items) => {
                  const idx = items[0].dataIndex;
                  const pt = res.curvePoints[idx];
                  return `L/d10 = ${pt.ldRatio} | UFRV = ${pt.ufrv} m³/m² | Clean-bed HL = ${pt.cleanBedHeadLoss} m`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'ขนาดประสิทธิผลของสารกรอง Effective Size ES (มม.)',
                font: { family: 'Sarabun', weight: 'bold', size: 12 }
              }
            },
            y: {
              min: 0,
              max: 100,
              title: {
                display: true,
                text: 'ระยะเวลาเดินบ่อกรอง Filter Run Time (ชั่วโมง)',
                font: { family: 'Sarabun', weight: 'bold', size: 12 }
              }
            }
          }
        }
      });
    }

    // Run Inverse Depth Calculator (Known ES, UC, v_F -> Required Depth L)
    const invES = Number(el('invKnownES').value) || 0.95;
    const invUC = Number(el('invKnownUC').value) || 1.40;
    const invVf = Number(el('invKnownVf').value) || 11.0;

    const filterModeMap = {
      single_sand: 'single',
      single_anthracite: 'single',
      dual_sand: 'dual_sand',
      dual_anthracite: 'dual_anthracite'
    };

    const invDepthRes = M.solveRequiredDepthForConditions({
      mediaType,
      esMM: invES,
      uc: invUC,
      filtrationRateMph: invVf,
      filterMode: filterModeMap[role] || 'single'
    });

    el('inverseDepthResultCard').innerHTML = `
      <div class="font-bold text-sky-950 text-sm mb-1">
        ความลึกชั้นสารกรองที่แนะนำ: <span class="num-mono text-lg text-sky-800">${fmt(invDepthRes.requiredDepthM, 2)} เมตร (${fmt(invDepthRes.requiredDepthCm, 0)} ซม.)</span>
      </div>
      <div class="text-slate-700 space-y-0.5">
        <div>• ดัชนี $L/d_{10}$ ที่ปรับแก้ตาม $v_F$ และ $UC$: <strong class="num-mono">${fmt(invDepthRes.adjustedLd, 0)}</strong> (ค่าฐาน ${fmt(invDepthRes.baseTargetLd, 0)})</div>
        <div>• ความลึกขั้นต่ำสุดตามเกณฑ์ Kawamura ($L/d_{10} = 1,000$ สำหรับชั้นเดี่ยว): <strong class="num-mono">${fmt(invDepthRes.minKawamuraDepthM, 2)} เมตร</strong></div>
      </div>
    `;

    // Build Sensitivity Matrix across UC = [1.3, 1.4, 1.5, 1.6] and v_F = [10, 11, 12] m/h
    const ucList = [1.30, 1.40, 1.50, 1.65];
    const vfList = [10.0, 11.0, 12.0];

    let tableHtml = `
      <thead>
        <tr>
          <th>ค่า $UC$</th>
          ${vfList.map((v) => `<th>$v_F = ${v.toFixed(0)}$ m/h</th>`).join('')}
        </tr>
      </thead>
      <tbody>
    `;

    ucList.forEach((uVal) => {
      tableHtml += `<tr><td class="font-bold num-mono">UC = ${uVal.toFixed(2)}</td>`;
      vfList.forEach((vVal) => {
        const cellSol = M.solveOptimalESForConditions({
          mediaType,
          layerRole: role,
          depthM,
          uc: uVal,
          filtrationRateMph: vVal,
          availableHeadM: availHead,
          maxBackwashRateMph: vBW,
          tempC
        });
        tableHtml += `<td class="num-mono"><strong>${fmt(cellSol.recommended.es, 2)}</strong> มม. <span class="text-slate-400">($d_{90}$=${fmt(cellSol.recommended.d90, 2)})</span></td>`;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody>`;
    el('sensitivityMatrixTable').innerHTML = tableHtml;
    renderMath(el('tab-reverse'));
  }

  // =========================================================================
  // TAB 3: BACKWASH HYDRAULICS & WASHOUT DIAGNOSTICS
  // =========================================================================
  function renderBackwashDiagnostics() {
    const calc = state.lastCalculation;
    if (!calc) return;

    const vBwHigh = Math.max(5, Number(el('bwHighRate').value) || 40.0);
    const vBwLow = Math.max(2, Number(el('bwLowRate').value) || 12.0);
    const qAir = Math.max(0, Number(el('bwAirRate').value) || 50.0);
    const troughFreeboard = Math.max(0.2, Number(el('bwTroughFreeboard').value) || 0.80);
    const tempC = calc.waterTemp;

    let totalInitialDepth = 0;
    let totalExpandedDepth = 0;

    const layerCardsHtml = calc.activeLayers
      .map((lr) => {
        const isAnth = lr.layerType === 'anthracite';
        const layerCfg = isAnth ? calc.preset.layers.anthracite : calc.preset.layers.sand;

        const mfD60 = M.calculateMinimumFluidizationVelocity(
          lr.current.d60,
          layerCfg.particleDensity,
          tempC
        );
        const mfD90 = M.calculateMinimumFluidizationVelocity(
          lr.current.d90,
          layerCfg.particleDensity,
          tempC
        );
        const vtD10 = M.calculateTerminalSettlingVelocity(
          lr.current.es,
          layerCfg.particleDensity,
          layerCfg.sphericity,
          tempC
        );
        const expCurr = M.calculateBedExpansion(
          layerCfg,
          lr.current.depthM,
          lr.current.es,
          lr.current.uc,
          vBwHigh,
          tempC
        );
        const collapsePulse = M.calculateCollapsePulsingWaterRate(
          qAir,
          lr.current.d60,
          layerCfg.particleDensity,
          tempC
        );

        totalInitialDepth += lr.current.depthM;
        totalExpandedDepth += expCurr.expandedDepth;

        const washoutRiskHigh = vBwHigh >= vtD10.vTMph * 0.75;
        const airOverflowRisk =
          vBwLow > collapsePulse.safeRangeMaxMph * 1.15
            ? 'อัตราน้ำขณะเป่าลมสูงเกินช่วง Collapse-Pulsing อาจพัดพาสารกรองลอยตัวสูงและหลุดออกหากระดับน้ำล้นรางพร้อมลม'
            : 'อยู่ในช่วง Collapse-Pulsing ที่เหมาะสม (25–50% ของ V_mf)';

        return `
          <div class="p-4 rounded-xl border border-slate-200 bg-white">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200">
              <div class="flex items-center gap-2">
                <span class="${isAnth ? 'layer-pill-anthracite' : 'layer-pill-sand'}">${lr.layerNameEn}</span>
                <h3 class="text-sm font-bold text-slate-900">${lr.layerNameTh} (สภาพปัจจุบัน ES = ${fmt(lr.current.es, 2)} มม., UC = ${fmt(lr.current.uc, 2)})</h3>
              </div>
              <span class="badge ${washoutRiskHigh ? 'badge-warn' : 'badge-pass'}">
                ${washoutRiskHigh ? 'มีความเสี่ยงพัดพาเม็ดเล็กหลุดหาย' : 'ความเร็วตกจมปลอดภัย'}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-semibold">ความเร็วลอยตัวต่ำสุด $V_{mf}$ (Wen &amp; Yu)</div>
                <div class="text-sm font-bold text-slate-900 num-mono mt-1">
                  ที่ $d_{60}$ (${fmt(lr.current.d60, 2)} มม.): ${fmt(mfD60.vMfMph, 1)} m/h
                </div>
                <div class="text-slate-600 num-mono mt-0.5">
                  ที่ $d_{90}$ (${fmt(lr.current.d90, 2)} มม.): ${fmt(mfD90.vMfMph, 1)} m/h
                </div>
              </div>

              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-semibold">ความเร็วตกจมของเม็ดเล็ก $V_t(d_{10})$</div>
                <div class="text-sm font-bold text-sky-900 num-mono mt-1">
                  $V_t(d_{10})$ = ${fmt(vtD10.vTMph, 1)} m/h
                </div>
                <div class="text-slate-600 mt-0.5">
                  เทียบกับน้ำล้างย้อน ${fmt(vBwHigh, 1)} m/h (${fmt((vBwHigh / vtD10.vTMph) * 100, 0)}% ของ $V_t$)
                </div>
              </div>

              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-semibold">การขยายตัวของชั้นสารกรอง (Dharmarajah)</div>
                <div class="text-sm font-bold text-emerald-800 num-mono mt-1">
                  ขยายตัว +${fmt(expCurr.expansionPercent, 1)}% (+${fmt(expCurr.expansionDelta * 100, 1)} ซม.)
                </div>
                <div class="text-slate-600 num-mono mt-0.5">
                  ความหนาแน่นขณะลอยตัว $\\rho_b$ = ${fmt(expCurr.bulkDensityFluidized, 0)} kg/m³
                </div>
              </div>

              <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-slate-500 font-semibold">Collapse-Pulsing (Amirtharajah Eq. 10-18)</div>
                <div class="text-sm font-bold text-amber-900 num-mono mt-1">
                  อัตราน้ำที่เหมาะสม: ${fmt(collapsePulse.idealSubfluidizationWaterMph, 1)} m/h
                </div>
                <div class="text-slate-600 mt-0.5">
                  ${airOverflowRisk}
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const totalExpansionRise = totalExpandedDepth - totalInitialDepth;
    const freeboardRemaining = troughFreeboard - totalExpansionRise;

    el('backwashDiagnosticsContainer').innerHTML = `
      <div class="p-4 rounded-xl ${freeboardRemaining < 0.15 ? 'bg-rose-50 border border-rose-300' : 'bg-sky-50 border border-sky-200'} text-xs">
        <div class="font-bold text-sm text-slate-900 mb-1">
          🔍 สรุปการวิเคราะห์ระยะยกตัวของชั้นสารกรองเทียบกับความสูงรางน้ำล้างย้อน (Washwater Trough Freeboard Check):
        </div>
        <div class="text-slate-700">
          เมื่อล้างย้อนด้วยอัตรา <strong>${fmt(vBwHigh, 1)} m/h</strong> ที่อุณหภูมิน้ำ <strong>${fmt(tempC, 1)} °C</strong> ชั้นสารกรองรวมจะขยายตัวเพิ่มขึ้น <strong>+${fmt(totalExpansionRise * 100, 1)} ซม.</strong>
          (เหลือระยะห่างจากผิวสารกรองที่ขยายตัวถึงขอบรางน้ำล้างย้อน = <strong>${fmt(freeboardRemaining * 100, 1)} ซม.</strong>)
          <br>• <strong>สาเหตุหลักที่ทำให้สารกรองหลุดหายในบ่อกรองจริง (AWWA 6th Ed. หน้า 10.55–10.58):</strong>
          (1) การเปิดเป่าลม Air Scour พร้อมน้ำในขณะที่ระดับน้ำล้นข้ามขอบรางน้ำล้างย้อน (ทำให้ฟองอากาศพาเม็ดแอนทราไซต์/ทรายละเอียดลอยข้ามราง),
          (2) การเกิด Jet Action / อุดตันบางส่วนของหัวกรองทำให้อัตราการไหลเฉพาะจุด (Local upflow velocity) สูงเกินค่า $V_t(d_{10})$,
          หรือ (3) การสึกกร่อน (Abrasion) ของเม็ดแอนทราไซต์ที่มีความแข็ง Mohs ต่ำ ทำให้แตกตัวเป็น Fines แล้วถูกพัดออกระหว่างการล้างย้อน
        </div>
      </div>
      ${layerCardsHtml}
    `;
    renderMath(el('tab-backwash'));
  }

  // =========================================================================
  // TAB 4: MULTI-FILTER BATCH PLANNER & CSV EXPORT
  // =========================================================================
  function addCurrentFilterToBatch() {
    const calc = state.lastCalculation;
    if (!calc) return;

    const modeKey = el('selectActiveModeForSummary').value;
    const sandSel = getSelectedModeMetrics(calc.sandResult, modeKey);
    const anthSel = calc.anthResult ? getSelectedModeMetrics(calc.anthResult, modeKey) : null;

    state.batchItems.push({
      id: Date.now() + Math.random(),
      filterName: calc.filterName,
      phaseName: calc.preset.shortName,
      area: calc.filterArea,
      modeLabel: sandSel.modeLabel,
      sand: sandSel,
      anthracite: anthSel
    });

    updateBatchBadge();
    renderBatchTable();
  }

  function loadDemoBatchItems() {
    state.batchItems = [];

    // Demo 1: Phase 1 F-01
    const p1 = M.PLANT_PRESETS.phase1_2;
    const r1Sand = M.calculateLayerReplenishment({
      layerConfig: p1.layers.sand,
      filterArea: p1.unitArea,
      currentDepth: 0.92,
      currentES: 1.03,
      currentUC: 1.48
    });
    state.batchItems.push({
      id: 1,
      filterName: 'บ่อกรอง F-101 (เฟส 1)',
      phaseName: p1.shortName,
      area: p1.unitArea,
      modeLabel: 'แนวทาง (ก-2): เติมสเปก Design + ปาดส่วนเพี้ยน',
      sand: getSelectedModeMetrics(r1Sand, 'A_skim'),
      anthracite: null
    });

    // Demo 2: Phase 3 F-302
    const p3 = M.PLANT_PRESETS.phase3;
    const r3Anth = M.calculateLayerReplenishment({
      layerConfig: p3.layers.anthracite,
      filterArea: p3.unitArea,
      currentDepth: 0.58,
      currentES: 1.64,
      currentUC: 1.58
    });
    const r3Sand = M.calculateLayerReplenishment({
      layerConfig: p3.layers.sand,
      filterArea: p3.unitArea,
      currentDepth: 0.62,
      currentES: 1.01,
      currentUC: 1.55
    });
    state.batchItems.push({
      id: 2,
      filterName: 'บ่อกรอง F-302 (เฟส 3)',
      phaseName: p3.shortName,
      area: p3.unitArea,
      modeLabel: 'แนวทาง (ก-2): เติมสเปก Design + ปาดส่วนเพี้ยน',
      sand: getSelectedModeMetrics(r3Sand, 'A_skim'),
      anthracite: getSelectedModeMetrics(r3Anth, 'A_skim')
    });

    // Demo 3: Phase 4 F-405
    const p4 = M.PLANT_PRESETS.phase4;
    const r4Anth = M.calculateLayerReplenishment({
      layerConfig: p4.layers.anthracite,
      filterArea: p4.unitArea,
      currentDepth: 0.44,
      currentES: 1.38,
      currentUC: 1.47
    });
    const r4Sand = M.calculateLayerReplenishment({
      layerConfig: p4.layers.sand,
      filterArea: p4.unitArea,
      currentDepth: 0.53,
      currentES: 0.71,
      currentUC: 1.56
    });
    state.batchItems.push({
      id: 3,
      filterName: 'บ่อกรอง F-405 (เฟส 4)',
      phaseName: p4.shortName,
      area: p4.unitArea,
      modeLabel: 'แนวทาง (ก-2): เติมสเปก Design + ปาดส่วนเพี้ยน',
      sand: getSelectedModeMetrics(r4Sand, 'A_skim'),
      anthracite: getSelectedModeMetrics(r4Anth, 'A_skim')
    });

    updateBatchBadge();
    renderBatchTable();
  }

  function updateBatchBadge() {
    el('batchCountBadge').textContent = state.batchItems.length;
  }

  function renderBatchTable() {
    const tbody = el('batchTableBody');
    const totalsBox = el('batchTotalsContainer');

    let totalSandM3 = 0;
    let totalSandTons = 0;
    let totalSandBags = 0;

    let totalAnthM3 = 0;
    let totalAnthTons = 0;
    let totalAnthBags = 0;

    state.batchItems.forEach((item) => {
      if (item.sand) {
        totalSandM3 += item.sand.orderVolumeM3;
        totalSandTons += item.sand.orderMassTons;
        totalSandBags += item.sand.numBags;
      }
      if (item.anthracite) {
        totalAnthM3 += item.anthracite.orderVolumeM3;
        totalAnthTons += item.anthracite.orderMassTons;
        totalAnthBags += item.anthracite.numBags;
      }
    });

    totalsBox.innerHTML = `
      <div class="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <div class="text-xs font-bold text-amber-900 uppercase">รวมปริมาณทรายกรอง (Silica Sand) ที่ต้องจัดซื้อ</div>
        <div class="text-2xl font-bold text-amber-950 num-mono mt-1">${fmt(totalSandM3, 1)} $\\text{m}^3$ (${fmt(totalSandTons, 1)} ตัน)</div>
        <div class="text-xs text-amber-800 mt-1">จำนวนถุง Big Bag (1 ตัน/ถุง): <strong>${totalSandBags} ถุง</strong></div>
      </div>

      <div class="p-4 rounded-xl bg-slate-800 text-white">
        <div class="text-xs font-bold text-slate-300 uppercase">รวมปริมาณแอนทราไซต์ (Anthracite) ที่ต้องจัดซื้อ</div>
        <div class="text-2xl font-bold text-sky-300 num-mono mt-1">${fmt(totalAnthM3, 1)} $\\text{m}^3$ (${fmt(totalAnthTons, 1)} ตัน)</div>
        <div class="text-xs text-slate-300 mt-1">จำนวนถุง Big Bag (1 ตัน/ถุง): <strong>${totalAnthBags} ถุง</strong></div>
      </div>

      <div class="p-4 rounded-xl bg-sky-50 border border-sky-200">
        <div class="text-xs font-bold text-sky-900 uppercase">รวมสารกรองทั้งหมด (${state.batchItems.length} บ่อกรอง)</div>
        <div class="text-2xl font-bold text-sky-950 num-mono mt-1">${fmt(totalSandM3 + totalAnthM3, 1)} $\\text{m}^3$ (${fmt(totalSandTons + totalAnthTons, 1)} ตัน)</div>
        <div class="text-xs text-sky-800 mt-1">รวมทั้งหมด: <strong>${totalSandBags + totalAnthBags} ถุง Big Bag</strong></div>
      </div>
    `;

    if (state.batchItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-8 text-slate-500">
            ยังไม่มีรายการบ่อกรองในตารางสรุป กดปุ่ม <strong>"➕ บันทึกบ่อนี้ลงตารางสรุปจัดซื้อ"</strong> ในแท็บที่ 1 หรือกด <strong>"📥 โหลดข้อมูลจำลองหลายบ่อ"</strong> ด้านบน
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.batchItems
      .map((item, index) => {
        const s = item.sand;
        const a = item.anthracite;
        return `
          <tr>
            <td class="num-mono font-bold">${index + 1}</td>
            <td>
              <div class="font-bold text-slate-900">${item.filterName}</div>
              <div class="text-xs text-slate-500">${item.phaseName}</div>
            </td>
            <td class="num-mono">${fmt(item.area, 1)}</td>
            <td class="text-xs">${item.modeLabel}</td>
            <td class="num-mono">
              +${fmt(s.depthAddCm, 1)} ซม.
              ${s.depthRemoveCm > 0.1 ? `<span class="text-rose-600 block text-xs">(ปาดออก ${fmt(s.depthRemoveCm, 1)} ซม.)</span>` : ''}
            </td>
            <td class="num-mono text-xs">ES ${fmt(s.supplyES, 2)} / UC ${fmt(s.supplyUC, 2)}</td>
            <td class="num-mono font-bold text-amber-900">${fmt(s.orderVolumeM3, 1)} m³ (${fmt(s.orderMassTons, 1)} ตัน)</td>
            <td class="num-mono">
              ${a ? `+${fmt(a.depthAddCm, 1)} ซม.` : '-'}
              ${a && a.depthRemoveCm > 0.1 ? `<span class="text-rose-600 block text-xs">(ปาดออก ${fmt(a.depthRemoveCm, 1)} ซม.)</span>` : ''}
            </td>
            <td class="num-mono text-xs">${a ? `ES ${fmt(a.supplyES, 2)} / UC ${fmt(a.supplyUC, 2)}` : '-'}</td>
            <td class="num-mono font-bold text-sky-900">${a ? `${fmt(a.orderVolumeM3, 1)} m³ (${fmt(a.orderMassTons, 1)} ตัน)` : '-'}</td>
            <td class="no-print">
              <button type="button" class="btn-danger-outline batch-del-btn" data-idx="${index}">ลบ</button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('.batch-del-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        state.batchItems.splice(idx, 1);
        updateBatchBadge();
        renderBatchTable();
      });
    });
  }

  function exportBatchToCSV() {
    if (state.batchItems.length === 0) return;

    const headers = [
      'ลำดับ',
      'ชื่อบ่อกรอง',
      'เฟส',
      'พื้นที่บ่อ (m2)',
      'แนวทางที่เลือก',
      'ทราย-ความลึกเติม (ซม.)',
      'ทราย-ความลึกปาดออก (ซม.)',
      'ทราย-ES สั่งซื้อ (มม.)',
      'ทราย-UC สั่งซื้อ',
      'ทราย-ปริมาตรสั่งซื้อ (m3)',
      'ทราย-น้ำหนักสั่งซื้อ (ตัน)',
      'แอนทราไซต์-ความลึกเติม (ซม.)',
      'แอนทราไซต์-ความลึกปาดออก (ซม.)',
      'แอนทราไซต์-ES สั่งซื้อ (มม.)',
      'แอนทราไซต์-UC สั่งซื้อ',
      'แอนทราไซต์-ปริมาตรสั่งซื้อ (m3)',
      'แอนทราไซต์-น้ำหนักสั่งซื้อ (ตัน)'
    ];

    const rows = state.batchItems.map((item, i) => {
      const s = item.sand;
      const a = item.anthracite;
      return [
        i + 1,
        `"${item.filterName}"`,
        `"${item.phaseName}"`,
        item.area.toFixed(1),
        `"${item.modeLabel}"`,
        s.depthAddCm.toFixed(1),
        s.depthRemoveCm.toFixed(1),
        s.supplyES.toFixed(2),
        s.supplyUC.toFixed(2),
        s.orderVolumeM3.toFixed(2),
        s.orderMassTons.toFixed(2),
        a ? a.depthAddCm.toFixed(1) : '0',
        a ? a.depthRemoveCm.toFixed(1) : '0',
        a ? a.supplyES.toFixed(2) : '-',
        a ? a.supplyUC.toFixed(2) : '-',
        a ? a.orderVolumeM3.toFixed(2) : '0',
        a ? a.orderMassTons.toFixed(2) : '0'
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MWA_Mahasawat_Filter_Media_Replenishment_Plan.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // EVENT BINDINGS & INITIALIZATION
  // =========================================================================
  function bindEvents() {
    // Main inputs trigger recalculation
    const calcInputIds = [
      'inputFilterName',
      'inputFilterArea',
      'inputFiltrationRate',
      'inputInfluentNTU',
      'inputWaterTemp',
      'inputSkimAllowance',
      'inputCompactAllowance',
      'designDepthAnth',
      'designESAnth',
      'designUCAnth',
      'currDepthAnth',
      'currESAnth',
      'currUCAnth',
      'supplyESAnth',
      'supplyUCAnth',
      'tolESAnth',
      'designDepthSand',
      'designESSand',
      'designUCSand',
      'currDepthSand',
      'currESSand',
      'currUCSand',
      'supplyESSand',
      'supplyUCSand',
      'tolESSand',
      'selectActiveModeForSummary',
      'selectChartLayer'
    ];

    calcInputIds.forEach((id) => {
      const node = el(id);
      if (node) {
        node.addEventListener('input', runMainCalculation);
        node.addEventListener('change', runMainCalculation);
      }
    });

    // Custom "What-If" Simulator input bindings
    const simInputIds = [
      'simSandUnit',
      'simSandVal',
      'simSandES',
      'simSandUC',
      'simSandSkimCm',
      'simAnthUnit',
      'simAnthVal',
      'simAnthES',
      'simAnthUC',
      'simAnthSkimCm',
      'simTestVf'
    ];
    simInputIds.forEach((id) => {
      const node = el(id);
      if (node) {
        node.addEventListener('input', runCustomSimulator);
        node.addEventListener('change', runCustomSimulator);
      }
    });

    if (el('simSandUnit')) {
      el('simSandUnit').addEventListener('change', () => {
        const u = el('simSandUnit').value;
        el('lblSimSandVal').textContent =
          u === 'm3' ? 'ปริมาณที่เติม (m³)' : u === 'tons' ? 'ปริมาณที่เติม (ตัน)' : 'ปริมาณที่เติม (ซม.)';
      });
    }

    if (el('simAnthUnit')) {
      el('simAnthUnit').addEventListener('change', () => {
        const u = el('simAnthUnit').value;
        el('lblSimAnthVal').textContent =
          u === 'm3' ? 'ปริมาณที่เติม (m³)' : u === 'tons' ? 'ปริมาณที่เติม (ตัน)' : 'ปริมาณที่เติม (ซม.)';
      });
    }

    document.querySelectorAll('.sim-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-preset-sim');
        const calc = state.lastCalculation;
        if (!calc || !calc.strategyEval) return;

        el('simSandUnit').value = 'cm';
        el('lblSimSandVal').textContent = 'ปริมาณที่เติม (ซม.)';
        el('simAnthUnit').value = 'cm';
        el('lblSimAnthVal').textContent = 'ปริมาณที่เติม (ซม.)';
        el('simSandSkimCm').value = '0.0';
        el('simAnthSkimCm').value = '0.0';

        if (mode === 'recommended') {
          const recOpt = calc.strategyEval.options[calc.strategyEval.recommendedOptionId];
          el('simSandVal').value = recOpt.quantities.sand.depthAddCm.toFixed(1);
          el('simAnthVal').value = recOpt.quantities.anthracite.depthAddCm.toFixed(1);
        } else if (mode === 'sand20') {
          el('simSandVal').value = '20.0';
          el('simAnthVal').value = '0.0';
        } else if (mode === 'anth25') {
          el('simSandVal').value = '0.0';
          el('simAnthVal').value = '25.0';
        } else if (mode === 'zero') {
          el('simSandVal').value = '0.0';
          el('simAnthVal').value = '0.0';
        }
        runCustomSimulator();
      });
    });

    // Multi-point random sampling panel toggle & actions
    el('btnToggleSamplingModal').addEventListener('click', () => {
      el('multiSamplePanel').classList.toggle('hidden');
      renderRandomSamplesTable();
    });

    el('selectSampleLayerTarget').addEventListener('change', renderRandomSamplesTable);

    el('btnAddSampleRow').addEventListener('click', () => {
      const targetLayer = el('selectSampleLayerTarget').value;
      const arr = state.randomSamples[targetLayer];
      const nextNum = arr.length + 1;
      arr.push({
        id: Date.now(),
        position: `จุดที่ ${nextNum} (สุ่มเพิ่ม)`,
        depthZone: 'สุ่มเก็บตามความลึก',
        layerDepthMeasured: targetLayer === 'anthracite' ? 0.58 : 0.92,
        weight: 1.0,
        es: targetLayer === 'anthracite' ? 1.62 : 1.02,
        uc: targetLayer === 'anthracite' ? 1.55 : 1.46
      });
      renderRandomSamplesTable();
    });

    el('btnApplyCompositeToLayer').addEventListener('click', () => {
      const targetLayer = el('selectSampleLayerTarget').value;
      const agg = M.aggregateRandomSamples(state.randomSamples[targetLayer]);
      if (!agg) return;

      if (targetLayer === 'anthracite') {
        if (agg.meanDepth !== null) el('currDepthAnth').value = agg.meanDepth.toFixed(2);
        el('currESAnth').value = agg.es.toFixed(2);
        el('currUCAnth').value = agg.uc.toFixed(2);
      } else {
        if (agg.meanDepth !== null) el('currDepthSand').value = agg.meanDepth.toFixed(2);
        el('currESSand').value = agg.es.toFixed(2);
        el('currUCSand').value = agg.uc.toFixed(2);
      }
      runMainCalculation();
    });

    el('btnResetToSampleDefect').addEventListener('click', () => {
      applyPreset(state.activePresetId, true);
    });

    // Reverse solver inputs
    const revInputIds = [
      'revLayerRole',
      'revDepthM',
      'revUC',
      'revFiltrationRate',
      'revAvailHead',
      'revBackwashRate',
      'invKnownES',
      'invKnownUC',
      'invKnownVf'
    ];
    revInputIds.forEach((id) => {
      const node = el(id);
      if (node) {
        node.addEventListener('input', runReverseSolver);
        node.addEventListener('change', runReverseSolver);
      }
    });

    document.querySelectorAll('.rev-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        el('revLayerRole').value = btn.getAttribute('data-role');
        el('revDepthM').value = btn.getAttribute('data-l');
        el('revUC').value = btn.getAttribute('data-uc');
        el('revFiltrationRate').value = btn.getAttribute('data-vf');
        el('revBackwashRate').value = btn.getAttribute('data-vbw');
        runReverseSolver();
      });
    });

    // Backwash tab inputs
    ['bwHighRate', 'bwLowRate', 'bwAirRate', 'bwTroughFreeboard'].forEach((id) => {
      const node = el(id);
      if (node) {
        node.addEventListener('input', renderBackwashDiagnostics);
      }
    });

    // Batch actions
    el('btnAddFilterToBatch').addEventListener('click', () => {
      addCurrentFilterToBatch();
      const btn = el('btnAddFilterToBatch');
      const oldText = btn.textContent;
      btn.textContent = '✅ บันทึกลงตารางแล้ว!';
      setTimeout(() => {
        btn.textContent = oldText;
      }, 1400);
    });

    el('btnLoadDemoBatch').addEventListener('click', loadDemoBatchItems);
    el('btnExportBatchCsv').addEventListener('click', exportBatchToCSV);
    el('btnClearBatch').addEventListener('click', () => {
      state.batchItems = [];
      updateBatchBadge();
      renderBatchTable();
    });

    el('btnPrintReport').addEventListener('click', () => {
      window.print();
    });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    bindEvents();
    applyPreset('phase1_2', true);
    loadDemoBatchItems();
    runReverseSolver();
    renderMath(document.body);
  });

  window.addEventListener('load', () => {
    renderMath(document.body);
  });
})();
