/**
 * MWA Mahasawat Water Treatment Plant - Filter Media Replenishment & Design Model
 * โมเดลคำนวณการเติมสารกรองและออกแบบพารามิเตอร์บ่อกรอง โรงงานผลิตน้ำมหาสวัสดิ์ (กปน.)
 *
 * Academic References:
 * 1. Crittenden, J. C., Trussell, R. R., Hand, D. W., Howe, K. J., & Tchobanoglous, G. (2012).
 *    MWH's Water Treatment: Principles and Design (3rd ed.). John Wiley & Sons. (Chapter 11: Granular Filtration)
 * 2. Edzwald, J. K. (Ed.). (2011). Water Quality & Treatment: A Handbook on Drinking Water (6th ed.).
 *    AWWA / McGraw-Hill. (Chapter 10: Granular Media Filtration, Tobiason, Cleasby, Logsdon, & O'Melia)
 * 3. Benjamin, M. M., & Lawler, D. F. (2013). Water Quality Engineering: Physical / Chemical Treatment Processes.
 *    John Wiley & Sons. (Chapter 14: Granular Media Filtration)
 * 4. AWWA Manual M37 (2011). Operational Control of Coagulation and Filtration Processes (3rd ed.).
 * 5. Kawamura, S. (2000). Integrated Design and Operation of Water Treatment Facilities (2nd ed.). John Wiley & Sons.
 * 6. Maha Sawat Water Treatment Plant Design Manuals (Phase 1 & 2 Aquazur "V", Phase 3 SG/OTV, Phase 4 ITA).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FilterMediaModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. PLANT DESIGN PRESETS (ข้อมูลการออกแบบบ่อกรอง โรงงานผลิตน้ำมหาสวัสดิ์)
  // =========================================================================
  const PLANT_PRESETS = {
    phase1_2: {
      id: 'phase1_2',
      name: 'เฟส 1 & 2 (Aquazur "V" - Single Media Sand)',
      shortName: 'Phase 1 & 2 (Aquazur V)',
      contractor: 'Degrémont (Aquazur "V" Filter)',
      filterType: 'single', // Single-media sand
      numFilters: 16,
      numFiltersNote: '16 บ่อ (เฟส 1 = 8 บ่อ, เฟส 2 = 8 บ่อ)',
      unitArea: 197.8, // m² (2 cells x 19.78 m x 5.0 m)
      dimensions: '2 × 19.78 m × 5.0 m',
      nominalFlowPerFilter: 2187, // m³/h
      normalFiltrationRate: 11.0, // m/h
      maxFiltrationRate: 12.57, // m/h (1 filter washing in a phase of 8)
      maxWaterDepthOverSand: 2.33, // m
      limitingHeadLoss: 1.80, // mWC (from Phase 1&2 Manual page A-13)
      troughHeightAboveMedia: 0.65, // m (typical Aquazur V weir height above fixed sand bed)
      backwash: {
        lowWashRate: 15.0, // m/h (simultaneous air + water wash)
        highWashRate: 25.0, // m/h (rinsing / surface sweep)
        airScourRate: 55.0, // m/h
        mode: 'Simultaneous Air + Subfluidization Water Wash'
      },
      gravel: {
        hasGravel: false,
        depth: 0.0,
        note: 'พื้นบ่อระบบหัวกรอง (Nozzle Slab Underdrain) ไม่ใช้ชั้นกรวดรองพื้น'
      },
      layers: {
        sand: {
          enabled: true,
          type: 'sand',
          nameTh: 'ทรายกรอง (Silica Sand)',
          nameEn: 'Silica Sand',
          designDepth: 1.20, // m
          designES: 0.95, // mm (spec range 0.90 - 1.00 mm)
          designESMin: 0.90,
          designESMax: 1.00,
          designUC: 1.40,
          particleDensity: 2650, // kg/m³
          porosity: 0.43, // dimensionless
          bulkDensity: 1510, // kg/m³ = 2650 * (1 - 0.43)
          sphericity: 0.78,
          erKv: 112.5, // Trussell & Chang (1999) midpoint for sand
          erKi: 2.25
        },
        anthracite: {
          enabled: false,
          type: 'anthracite',
          nameTh: 'แอนทราไซต์ (Anthracite)',
          nameEn: 'Anthracite',
          designDepth: 0.0,
          designES: 1.40,
          designESMin: 1.30,
          designESMax: 1.50,
          designUC: 1.40,
          particleDensity: 1600,
          porosity: 0.50,
          bulkDensity: 800,
          sphericity: 0.55,
          erKv: 228.0,
          erKi: 4.4
        }
      }
    },

    phase3: {
      id: 'phase3',
      name: 'เฟส 3 (Dual Media: Anthracite + Sand)',
      shortName: 'Phase 3 (SG/OTV Dual Media)',
      contractor: 'SG/OTV Consortium',
      filterType: 'dual',
      numFilters: 14,
      numFiltersNote: '14 บ่อ (420,000 CMD)',
      unitArea: 112.0, // m²
      dimensions: '112.0 m² / บ่อ',
      nominalFlowPerFilter: 1243, // m³/h
      normalFiltrationRate: 11.1, // m/h (267.9 m/day)
      maxFiltrationRate: 12.0, // m/h (288 m/day under 1 filter washing)
      maxWaterDepthOverSand: 2.40, // m
      limitingHeadLoss: 2.00, // mWC
      troughHeightAboveMedia: 0.90, // m above top of anthracite
      backwash: {
        lowWashRate: 8.0, // m³/m²/h at Air Scouring and Washing
        highWashRate: 55.0, // m³/m²/h at Rinsing
        airScourRate: 50.0, // m³/m²/h
        mode: 'Air Scour + Low-Rate Water (8 m/h) followed by High-Rate Fluidization Rinse (55 m/h)'
      },
      gravel: {
        hasGravel: true,
        depth: 0.20, // m
        note: 'ชั้นกรวดรองพื้น (Supporting Gravel) ความหนา 0.20 ม.'
      },
      layers: {
        anthracite: {
          enabled: true,
          type: 'anthracite',
          nameTh: 'แอนทราไซต์ (Anthracite - ชั้นบน)',
          nameEn: 'Anthracite (Top Layer)',
          designDepth: 0.80, // m
          designES: 1.55, // mm
          designESMin: 1.47,
          designESMax: 1.63,
          designUC: 1.50,
          particleDensity: 1600, // kg/m³
          porosity: 0.50,
          bulkDensity: 800, // kg/m³
          sphericity: 0.55,
          erKv: 228.0,
          erKi: 4.4
        },
        sand: {
          enabled: true,
          type: 'sand',
          nameTh: 'ทรายกรอง (Silica Sand - ชั้นล่าง)',
          nameEn: 'Silica Sand (Bottom Layer)',
          designDepth: 0.70, // m
          designES: 0.95, // mm (spec 0.9 - 1.0 mm)
          designESMin: 0.90,
          designESMax: 1.00,
          designUC: 1.50,
          particleDensity: 2650, // kg/m³
          porosity: 0.42,
          bulkDensity: 1537, // kg/m³
          sphericity: 0.78,
          erKv: 112.5,
          erKi: 2.25
        }
      }
    },

    phase4: {
      id: 'phase4',
      name: 'เฟส 4 (Dual Media: Anthracite + Sand)',
      shortName: 'Phase 4 (ITA Dual Media)',
      contractor: 'ITA Consortium (United Group)',
      filterType: 'dual',
      numFilters: 14,
      numFiltersNote: '14 บ่อ (412,000 CMD)',
      unitArea: 111.6, // m²
      dimensions: '111.6 m² / บ่อ',
      nominalFlowPerFilter: 1228, // m³/h
      normalFiltrationRate: 11.0, // m/h (264 m/day)
      maxFiltrationRate: 11.8, // m/h (283.2 m/day under 1 filter washing)
      maxWaterDepthOverSand: 2.40, // m
      limitingHeadLoss: 2.00, // mWC
      troughHeightAboveMedia: 0.90, // m
      backwash: {
        lowWashRate: 15.7, // m³/m²/h at Air Scouring and Washing
        highWashRate: 40.3, // m³/m²/h at Rinsing
        airScourRate: 50.0, // m³/m²/h
        mode: 'Air Scour + Low-Rate Water (15.7 m/h) followed by High-Rate Fluidization Rinse (40.3 m/h)'
      },
      gravel: {
        hasGravel: true,
        depth: 0.20, // m
        note: 'ชั้นกรวดรองพื้น (Supporting Gravel) ความหนา 0.20 ม.'
      },
      layers: {
        anthracite: {
          enabled: true,
          type: 'anthracite',
          nameTh: 'แอนทราไซต์ (Anthracite - ชั้นบน)',
          nameEn: 'Anthracite (Top Layer)',
          designDepth: 0.60, // m
          designES: 1.30, // mm
          designESMin: 1.24,
          designESMax: 1.37,
          designUC: 1.40,
          particleDensity: 1600, // kg/m³
          porosity: 0.50,
          bulkDensity: 800, // kg/m³
          sphericity: 0.55,
          erKv: 228.0,
          erKi: 4.4
        },
        sand: {
          enabled: true,
          type: 'sand',
          nameTh: 'ทรายกรอง (Silica Sand - ชั้นล่าง)',
          nameEn: 'Silica Sand (Bottom Layer)',
          designDepth: 0.60, // m
          designES: 0.66, // mm
          designESMin: 0.63,
          designESMax: 0.69,
          designUC: 1.50,
          particleDensity: 2650, // kg/m³
          porosity: 0.42,
          bulkDensity: 1537, // kg/m³
          sphericity: 0.78,
          erKv: 112.5,
          erKi: 2.25
        }
      }
    },

    custom: {
      id: 'custom',
      name: 'กำหนดเอง (Custom Filter Design)',
      shortName: 'Custom Design',
      contractor: 'User Defined',
      filterType: 'dual',
      numFilters: 10,
      numFiltersNote: 'กำหนดเอง',
      unitArea: 112.0,
      dimensions: 'กำหนดพื้นที่เอง',
      nominalFlowPerFilter: 1232,
      normalFiltrationRate: 11.0,
      maxFiltrationRate: 12.0,
      maxWaterDepthOverSand: 2.40,
      limitingHeadLoss: 2.00,
      troughHeightAboveMedia: 0.90,
      backwash: {
        lowWashRate: 12.0,
        highWashRate: 45.0,
        airScourRate: 50.0,
        mode: 'Air Scour + Fluidization Water Backwash'
      },
      gravel: {
        hasGravel: true,
        depth: 0.20,
        note: 'ปรับตั้งค่าได้ตามต้องการ'
      },
      layers: {
        anthracite: {
          enabled: true,
          type: 'anthracite',
          nameTh: 'แอนทราไซต์ (Anthracite - ชั้นบน)',
          nameEn: 'Anthracite (Top Layer)',
          designDepth: 0.70,
          designES: 1.40,
          designESMin: 1.33,
          designESMax: 1.47,
          designUC: 1.45,
          particleDensity: 1600,
          porosity: 0.50,
          bulkDensity: 800,
          sphericity: 0.55,
          erKv: 228.0,
          erKi: 4.4
        },
        sand: {
          enabled: true,
          type: 'sand',
          nameTh: 'ทรายกรอง (Silica Sand - ชั้นล่าง)',
          nameEn: 'Silica Sand (Bottom Layer)',
          designDepth: 0.65,
          designES: 0.80,
          designESMin: 0.76,
          designESMax: 0.84,
          designUC: 1.50,
          particleDensity: 2650,
          porosity: 0.42,
          bulkDensity: 1537,
          sphericity: 0.78,
          erKv: 112.5,
          erKi: 2.25
        }
      }
    }
  };

  // =========================================================================
  // 2. STATISTICAL & LOG-NORMAL GRAIN SIZE DISTRIBUTION ENGINE
  // =========================================================================

  /**
   * Standard Normal Cumulative Distribution Function Φ(z)
   * Abramowitz & Stegun (1964) Formula 7.1.26 (Max absolute error < 1.5e-7)
   */
  function normalCDF(z) {
    if (z < -8.0) return 0.0;
    if (z > 8.0) return 1.0;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * erf);
  }

  /**
   * Inverse Standard Normal CDF Φ⁻¹(p)
   * Peter J. Acklam's algorithm (Relative error < 1.15e-9)
   */
  function normalInv(p) {
    if (p <= 0) return -8.0;
    if (p >= 1) return 8.0;

    const a = [
      -3.969683028665376e+01,
       2.209460984245205e+02,
      -2.759285104469687e+02,
       1.383577518672690e+02,
      -3.066479806614716e+01,
       2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01,
       1.615858368580409e+02,
      -1.556989798598866e+02,
       6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
       4.374664141464968e+00,
       2.938163982698783e+00
    ];
    const d = [
       7.784695709041462e-03,
       3.224671290700398e-01,
       2.445134137142996e+00,
       3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1.0 - pLow;
    let q, r;

    if (p < pLow) {
      q = Math.sqrt(-2.0 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0);
    } else {
      q = Math.sqrt(-2.0 * Math.log(1.0 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
    }
  }

  const Z_10 = normalInv(0.10); // -1.2815515655446004
  const Z_50 = 0.0;
  const Z_60 = normalInv(0.60); // +0.2533471031357997
  const Z_90 = normalInv(0.90); // +1.2815515655446004
  const DELTA_Z_60_10 = Z_60 - Z_10; // 1.5348986686804001

  /**
   * Convert (ES = d10, UC = d60/d10) to Log-Normal distribution parameters
   */
  function getLogNormalParams(es, uc) {
    const safeES = Math.max(0.05, Number(es) || 0.5);
    const safeUC = Math.max(1.02, Number(uc) || 1.4);
    const sigmaLn = Math.log(safeUC) / DELTA_Z_60_10;
    const muLn = Math.log(safeES) - Z_10 * sigmaLn;
    const d50 = Math.exp(muLn);
    const d60 = safeES * safeUC;
    // AWWA 6th Ed. Eq. 10-1: d90 = d10 * 10^(1.67 * log10(UC))
    const d90 = Math.exp(muLn + Z_90 * sigmaLn);
    return {
      es: safeES,
      d10: safeES,
      d50: d50,
      d60: d60,
      d90: d90,
      uc: safeUC,
      muLn: muLn,
      sigmaLn: sigmaLn
    };
  }

  /**
   * Cumulative fraction passing sieve diameter d (mm) for single log-normal media
   */
  function logNormalPassing(d, es, uc) {
    if (d <= 0) return 0;
    const { muLn, sigmaLn } = getLogNormalParams(es, uc);
    if (sigmaLn <= 1e-7) return d >= es ? 1.0 : 0.0;
    return normalCDF((Math.log(d) - muLn) / sigmaLn);
  }

  /**
   * Diameter d_P (mm) at percentile P (0 to 1) for single log-normal media
   */
  function logNormalPercentile(p, es, uc) {
    const { muLn, sigmaLn } = getLogNormalParams(es, uc);
    const z = normalInv(p);
    return Math.exp(muLn + z * sigmaLn);
  }

  /**
   * Compute Composite Grain Size Distribution from multiple components/samples
   * components: Array of { weight, es, uc }
   * Returns { es (d10), d50, d60, d90, uc, cdfFunc }
   */
  function computeCompositeDistribution(components) {
    const valid = (components || []).filter(
      (c) => c && Number(c.weight) > 0 && Number(c.es) > 0 && Number(c.uc) >= 1.01
    );
    if (valid.length === 0) {
      return getLogNormalParams(1.0, 1.4);
    }

    const totalWeight = valid.reduce((acc, c) => acc + Number(c.weight), 0);
    const normalized = valid.map((c) => {
      const params = getLogNormalParams(Number(c.es), Number(c.uc));
      return {
        w: Number(c.weight) / totalWeight,
        ...params
      };
    });

    function compositeCDF(d) {
      if (d <= 0) return 0;
      const lnD = Math.log(d);
      let sum = 0;
      for (let i = 0; i < normalized.length; i++) {
        const comp = normalized[i];
        sum += comp.w * normalCDF((lnD - comp.muLn) / comp.sigmaLn);
      }
      return sum;
    }

    function findQuantile(targetP) {
      // Bracket in log-space
      let lowLn = Math.log(0.01);
      let highLn = Math.log(50.0);
      for (let iter = 0; iter < 65; iter++) {
        const midLn = 0.5 * (lowLn + highLn);
        const val = compositeCDF(Math.exp(midLn));
        if (val < targetP) {
          lowLn = midLn;
        } else {
          highLn = midLn;
        }
        if (highLn - lowLn < 1e-9) break;
      }
      return Math.exp(0.5 * (lowLn + highLn));
    }

    const d10 = findQuantile(0.10);
    const d50 = findQuantile(0.50);
    const d60 = findQuantile(0.60);
    const d90 = findQuantile(0.90);
    const uc = d60 / d10;

    // Also compute arithmetic weighted averages for comparison
    const arithES = normalized.reduce((s, c) => s + c.w * c.es, 0);
    const arithUC = normalized.reduce((s, c) => s + c.w * c.uc, 0);

    return {
      es: d10,
      d10: d10,
      d50: d50,
      d60: d60,
      d90: d90,
      uc: uc,
      arithES: arithES,
      arithUC: arithUC,
      components: normalized,
      cdf: compositeCDF
    };
  }

  /**
   * Aggregate random multi-point / multi-depth samples for a filter layer
   * samples: Array of { id, position, depthSampled, layerDepthMeasured, weight, es, uc }
   */
  function aggregateRandomSamples(samples) {
    const valid = (samples || []).filter(
      (s) => s && Number(s.es) > 0 && Number(s.uc) > 1.0
    );
    if (valid.length === 0) return null;

    // Depth statistics from samples that have a measured layer thickness
    const depthSamples = valid
      .map((s) => Number(s.layerDepthMeasured))
      .filter((d) => !isNaN(d) && d > 0);

    let meanDepth = null;
    let sdDepth = 0;
    let minDepth = null;
    let maxDepth = null;

    if (depthSamples.length > 0) {
      meanDepth = depthSamples.reduce((a, b) => a + b, 0) / depthSamples.length;
      minDepth = Math.min(...depthSamples);
      maxDepth = Math.max(...depthSamples);
      if (depthSamples.length > 1) {
        const variance =
          depthSamples.reduce((acc, val) => acc + Math.pow(val - meanDepth, 2), 0) /
          (depthSamples.length - 1);
        sdDepth = Math.sqrt(variance);
      }
    }

    const components = valid.map((s) => ({
      weight: Number(s.weight) > 0 ? Number(s.weight) : 1.0,
      es: Number(s.es),
      uc: Number(s.uc)
    }));

    const composite = computeCompositeDistribution(components);

    return {
      sampleCount: valid.length,
      meanDepth: meanDepth,
      sdDepth: sdDepth,
      minDepth: minDepth,
      maxDepth: maxDepth,
      es: composite.es,
      d10: composite.d10,
      d50: composite.d50,
      d60: composite.d60,
      d90: composite.d90,
      uc: composite.uc,
      arithES: composite.arithES,
      arithUC: composite.arithUC,
      cdf: composite.cdf
    };
  }

  // =========================================================================
  // 3. WATER PHYSICAL PROPERTIES & HYDRAULIC / BACKWASH EQUATIONS
  // =========================================================================

  /**
   * Water density ρ_w (kg/m³) and dynamic viscosity μ (Pa·s = kg/(m·s))
   * as a function of water temperature T (°C) (MWH Appendix C / AWWA Appendix D)
   */
  function getWaterProperties(tempC) {
    const T = Math.max(0, Math.min(45, Number(tempC) || 28));
    // Density (kg/m³)
    const rhoW =
      999.842594 +
      6.793952e-2 * T -
      9.095290e-3 * T * T +
      1.001685e-4 * T * T * T -
      1.120083e-6 * Math.pow(T, 4) +
      6.536332e-9 * Math.pow(T, 5);
    // Dynamic viscosity (Pa·s) - Vogel/Andrade equation accurate for 0-40°C
    const mu = 2.414e-5 * Math.pow(10, 247.8 / (T + 133.15));
    const nu = mu / rhoW; // m²/s
    return { tempC: T, rhoW, mu, nu, g: 9.80665 };
  }

  /**
   * Clean-Bed Head Loss (mWC) using Trussell & Chang (1999) / Ergun Equation (MWH Eq. 11-13)
   * Also supports stratified bed calculation where UC increases fine-grain resistance
   */
  function calculateCleanBedHeadLoss(layer, depthM, esMM, uc, filtrationRateMph, tempC) {
    const L = Math.max(0, Number(depthM) || 0);
    if (L <= 0) return { totalHeadLoss: 0, viscousLoss: 0, kineticLoss: 0 };

    const es = Math.max(0.1, Number(esMM) || 0.8);
    const safeUC = Math.max(1.05, Number(uc) || 1.4);
    const vF = Math.max(0, Number(filtrationRateMph) || 11.0) / 3600.0; // m/s
    const { rhoW, mu, g } = getWaterProperties(tempC);

    const eps = Number(layer.porosity) || (layer.type === 'anthracite' ? 0.50 : 0.42);
    const kV = Number(layer.erKv) || (layer.type === 'anthracite' ? 228.0 : 112.5);
    const kI = Number(layer.erKi) || (layer.type === 'anthracite' ? 4.4 : 2.25);

    // Trussell & Chang (1999) calibrated kV and kI using d = ES (d10) at standard UC (~1.4-1.5).
    // When a bed stratifies after backwash with higher UC, fine grains at top increase head loss slightly.
    // We integrate across 5 log-normal strata or apply the Fair-Hatch harmonic mean adjustment relative to reference UC = 1.45.
    const dMeters = es * 1e-3;
    const ucFactor = 1.0 + 0.12 * Math.max(0, safeUC - 1.45);

    const viscousLoss =
      ucFactor *
      ((kV * Math.pow(1 - eps, 2)) / Math.pow(eps, 3)) *
      ((mu * L * vF) / (rhoW * g * dMeters * dMeters));

    const kineticLoss =
      ((kI * (1 - eps)) / Math.pow(eps, 3)) *
      ((L * vF * vF) / (g * dMeters));

    return {
      totalHeadLoss: viscousLoss + kineticLoss,
      viscousLoss,
      kineticLoss
    };
  }

  /**
   * Minimum Fluidization Velocity V_mf (m/h and m/s) using Wen & Yu (1966) correlation
   * AWWA 6th Ed. Eq. (10-20) and Eq. (10-21)
   */
  function calculateMinimumFluidizationVelocity(diameterMM, particleDensity, tempC) {
    const d = Math.max(0.05, Number(diameterMM) || 1.0) * 1e-3; // m
    const rhoS = Math.max(1050, Number(particleDensity) || 2650); // kg/m³
    const { rhoW, mu, g } = getWaterProperties(tempC);

    // Galileo number Ga = d^3 * rhoW * (rhoS - rhoW) * g / mu^2
    const Ga = (Math.pow(d, 3) * rhoW * (rhoS - rhoW) * g) / (mu * mu);

    // Re_mf = sqrt(33.7^2 + 0.0408 * Ga) - 33.7
    const ReMf = Math.sqrt(33.7 * 33.7 + 0.0408 * Ga) - 33.7;
    const vMfMps = (ReMf * mu) / (rhoW * d);
    const vMfMph = vMfMps * 3600.0;

    return {
      Ga,
      ReMf,
      vMfMps,
      vMfMph,
      recommendedBackwashMph: 1.3 * vMfMph // Cleasby & Fan (1981): 1.3 * V_mf(d90)
    };
  }

  /**
   * Terminal Settling Velocity V_t (m/h) of a filter grain (for washout diagnostic of d10 fines)
   * Using Haider & Levenspiel (1989) / Dietrich correlation for non-spherical grains
   */
  function calculateTerminalSettlingVelocity(diameterMM, particleDensity, sphericity, tempC) {
    const d = Math.max(0.05, Number(diameterMM) || 0.5) * 1e-3;
    const rhoS = Math.max(1050, Number(particleDensity) || 2650);
    const psi = Math.max(0.4, Math.min(1.0, Number(sphericity) || 0.75));
    const { rhoW, mu, g } = getWaterProperties(tempC);

    // Dimensionless particle diameter d* = d * [g * rhoW * (rhoS - rhoW) / mu^2]^(1/3)
    const Ga = (Math.pow(d, 3) * rhoW * (rhoS - rhoW) * g) / (mu * mu);
    const dStar = Math.cbrt(Ga);

    // Haider & Levenspiel (1989) dimensionless terminal velocity u*
    const term1 = 18.0 / (dStar * dStar);
    const term2 = (2.3348 - 1.7439 * psi) / Math.pow(dStar, 0.5);
    const uStar = Math.pow(term1 + term2, -1.0);

    const vTMps = uStar * Math.cbrt((mu * (rhoS - rhoW) * g) / (rhoW * rhoW));
    return {
      vTMps,
      vTMph: vTMps * 3600.0
    };
  }

  /**
   * Fluidized Bed Expansion Model using Dharmarajah & Cleasby (1986)
   * AWWA 6th Ed. Eq. (10-22), (10-23), (10-24), (10-25)
   */
  function calculateBedExpansion(layer, depthM, esMM, uc, backwashRateMph, tempC) {
    const L0 = Math.max(0, Number(depthM) || 0);
    if (L0 <= 0) {
      return { expandedDepth: 0, expansionPercent: 0, expandedPorosity: layer.porosity || 0.45, bulkDensityFluidized: 1000 };
    }

    const V = Math.max(0.1, Number(backwashRateMph) || 40.0) / 3600.0; // m/s
    const rhoS = Number(layer.particleDensity) || 2650;
    const eps0 = Number(layer.porosity) || 0.43;
    const psi = Number(layer.sphericity) || 0.75;
    const { rhoW, mu, g } = getWaterProperties(tempC);

    // Divide bed into 5 size segments (10%, 30%, 50%, 70%, 90% quantiles) per AWWA Example 10-3
    const quantiles = [0.10, 0.30, 0.50, 0.70, 0.90];
    let totalExpandedRatio = 0;
    let avgExpandedEps = 0;

    for (let i = 0; i < quantiles.length; i++) {
      const dMM = logNormalPercentile(quantiles[i], esMM, uc);
      const d = dMM * 1e-3;
      const Sv = 6.0 / (psi * d); // m⁻¹

      // Solve Dharmarajah & Cleasby (1986) Eq. 10-24 for expanded porosity ε in [eps0, 0.96]
      let lowEps = eps0;
      let highEps = 0.96;
      const logPsiTerm = 1.5 * Math.pow(Math.log10(psi), 2);

      for (let iter = 0; iter < 50; iter++) {
        const eps = 0.5 * (lowEps + highEps);
        const Re1 = (rhoW * V) / (Sv * (1.0 - eps) * mu);
        const logRe1 = Math.log10(Math.max(1e-6, Re1));
        const A1 =
          (Math.pow(eps, 3) / Math.pow(1.0 - eps, 2)) *
          ((rhoW * (rhoS - rhoW) * g) / (Math.pow(Sv, 3) * mu * mu));
        const lhs = Math.log10(Math.max(1e-9, A1));
        const rhs =
          0.56543 +
          1.09348 * logRe1 +
          0.17971 * Math.pow(logRe1, 2) -
          0.00392 * Math.pow(logRe1, 4) -
          logPsiTerm;

        // Note: As eps increases, lhs increases rapidly while rhs increases more slowly
        if (lhs < rhs) {
          lowEps = eps;
        } else {
          highEps = eps;
        }
      }

      const solvedEps = Math.max(eps0, 0.5 * (lowEps + highEps));
      const segmentRatio = (1.0 - eps0) / (1.0 - solvedEps);
      totalExpandedRatio += segmentRatio / quantiles.length;
      avgExpandedEps += solvedEps / quantiles.length;
    }

    const expandedDepth = L0 * totalExpandedRatio;
    const expansionPercent = (totalExpandedRatio - 1.0) * 100.0;
    // Bulk density of fluidized bed: AWWA Eq. 10-26: ρ_b = (1 - ε)*ρ_s + ρ_w*ε
    const bulkDensityFluidized = (1.0 - avgExpandedEps) * rhoS + rhoW * avgExpandedEps;

    return {
      initialDepth: L0,
      expandedDepth: expandedDepth,
      expansionDelta: expandedDepth - L0,
      expansionPercent: expansionPercent,
      expandedPorosity: avgExpandedEps,
      bulkDensityFluidized: bulkDensityFluidized
    };
  }

  /**
   * Collapse-Pulsing Air + Subfluidization Water Check (Amirtharajah, 1984)
   * AWWA 6th Ed. Eq. (10-18): 0.45 * Qa^2 + 100 * (V / V_mf60) = 41.9
   * where Qa is in scfm/ft² (1 scfm/ft² = 18.288 m/h)
   */
  function calculateCollapsePulsingWaterRate(airScourMph, d60MM, particleDensity, tempC) {
    const QaScfm = Math.max(0, Number(airScourMph) || 50.0) / 18.288;
    const mf60 = calculateMinimumFluidizationVelocity(d60MM, particleDensity, tempC);
    const ratioVtoVmf = Math.max(0.05, (41.9 - 0.45 * QaScfm * QaScfm) / 100.0);
    const idealWaterMph = ratioVtoVmf * mf60.vMfMph;
    return {
      airScourMph,
      QaScfm,
      vMf60Mph: mf60.vMfMph,
      idealRatioPercent: ratioVtoVmf * 100.0,
      idealSubfluidizationWaterMph: idealWaterMph,
      safeRangeMinMph: 0.25 * mf60.vMfMph,
      safeRangeMaxMph: 0.50 * mf60.vMfMph
    };
  }

  // =========================================================================
  // 4. THREE REPLENISHMENT MODES (3 แนวทางการคำนวณการเติมสารกรอง)
  // =========================================================================

  /**
   * Calculate Replenishment for a Single Layer across all 3 Academic Modes:
   * - Mode A: เติมสารกรองสเปก Design ให้ได้ระดับความลึกเดิม + วิเคราะห์การปาด/ลอกเปลี่ยน (Standard Spec + Skim/Replace)
   * - Mode B: คำนวณสเปกสารกรองใหม่ (ES_new, UC_new) เพื่อผสม (Blend) กับสารกรองเดิมให้ได้ตาม Design
   * - Mode C: ปรับระดับความลึกชดเชยตามสัดส่วน L/d_e (Filtration Capacity Equivalence)
   */
  function calculateLayerReplenishment(params) {
    const {
      layerConfig, // from preset (designDepth, designES, designUC, bulkDensity, etc.)
      filterArea, // m²
      currentDepth, // m
      currentES, // mm
      currentUC, // dimensionless
      customNewES, // optional override for Mode A/C new media ES (defaults to designES)
      customNewUC, // optional override for Mode A/C new media UC (defaults to designUC)
      esTolerancePct = 5.0, // % acceptable deviation from Design ES (AWWA B100 max is 10%, strict is 5%)
      ucToleranceAbs = 0.08, // acceptable positive deviation on UC above Design UC
      skimmingAllowancePct = 3.0, // % allowance for skimming fines after installation
      compactionAllowancePct = 7.0, // % allowance for hydraulic compaction & handling loss
      bagWeightKg = 1000 // Big Bag weight (kg)
    } = params;

    const L_design = Math.max(0.05, Number(layerConfig.designDepth));
    const ES_design = Math.max(0.1, Number(layerConfig.designES));
    const UC_design = Math.max(1.05, Number(layerConfig.designUC));
    const rhoBulk = Number(layerConfig.bulkDensity) || (layerConfig.type === 'anthracite' ? 800 : 1510); // kg/m³
    const area = Math.max(1.0, Number(filterArea) || 112.0);

    const L_curr = Math.max(0.0, Number(currentDepth));
    const ES_curr = Math.max(0.1, Number(currentES) || ES_design);
    const UC_curr = Math.max(1.05, Number(currentUC) || UC_design);

    const ES_supply = Number(customNewES) > 0 ? Number(customNewES) : ES_design;
    const UC_supply = Number(customNewUC) > 1.0 ? Number(customNewUC) : UC_design;

    const totalAllowanceFactor = 1.0 + (Number(skimmingAllowancePct) + Number(compactionAllowancePct)) / 100.0;

    // Helper to convert depth to volume, mass, and bags
    function quantifyMedia(depthAddM, depthRemoveM = 0) {
      const dAdd = Math.max(0, depthAddM);
      const dRem = Math.max(0, depthRemoveM);
      const netVolumeM3 = area * dAdd;
      const orderVolumeM3 = netVolumeM3 * totalAllowanceFactor;
      const netMassTons = (netVolumeM3 * rhoBulk) / 1000.0;
      const orderMassTons = (orderVolumeM3 * rhoBulk) / 1000.0;
      const removeVolumeM3 = area * dRem;
      const removeMassTons = (removeVolumeM3 * rhoBulk) / 1000.0;
      const numBags = Math.ceil((orderMassTons * 1000.0) / Math.max(1, bagWeightKg));
      return {
        depthAddM: dAdd,
        depthAddCm: dAdd * 100.0,
        depthRemoveM: dRem,
        depthRemoveCm: dRem * 100.0,
        netVolumeM3,
        orderVolumeM3,
        netMassTons,
        orderMassTons,
        removeVolumeM3,
        removeMassTons,
        numBags
      };
    }

    // Current state metrics
    const currentDist = getLogNormalParams(ES_curr, UC_curr);
    const designDist = getLogNormalParams(ES_design, UC_design);
    const L_missing_raw = Math.max(0, L_design - L_curr);
    const L_excess_raw = Math.max(0, L_curr - L_design);

    const R_design = (L_design * 1000.0) / ES_design; // L/d10 ratio
    const R_current = L_curr > 0 ? (L_curr * 1000.0) / ES_curr : 0;

    // Allowed ES range in Mode A
    const esMinAllowed = ES_design * (1.0 - esTolerancePct / 100.0);
    const esMaxAllowed = ES_design * (1.0 + esTolerancePct / 100.0);
    const ucMaxAllowed = UC_design + ucToleranceAbs;

    function isWithinSpec(esVal, ucVal) {
      return esVal >= esMinAllowed - 1e-4 && esVal <= esMaxAllowed + 1e-4 && ucVal <= ucMaxAllowed + 1e-4;
    }

    // -----------------------------------------------------------------------
    // MODE A: เติมสารกรองสเปก Design ให้ได้ระดับความลึกเดิม + วิเคราะห์การปาด/ลอกเปลี่ยน
    // -----------------------------------------------------------------------
    const L_rem_topupOnly = Math.min(L_curr, L_design);
    const L_add_topupOnly = Math.max(0, L_design - L_rem_topupOnly);

    const mixTopupOnly = computeCompositeDistribution([
      { weight: L_rem_topupOnly, es: ES_curr, uc: UC_curr },
      { weight: L_add_topupOnly, es: ES_supply, uc: UC_supply }
    ]);

    const topupOnlyPass = isWithinSpec(mixTopupOnly.es, mixTopupOnly.uc);

    // If top-up only does not meet ES/UC tolerance, find minimum depth L_remove of existing media to skim/remove
    let L_remove_opt = L_excess_raw; // if currentDepth > designDepth, we at least remove excess
    let mixAfterSkim = mixTopupOnly;

    if (!topupOnlyPass && isWithinSpec(ES_supply, UC_supply)) {
      // Search L_rem in [0, L_rem_topupOnly] (from largest remaining to 0)
      let lowRem = 0.0;
      let highRem = L_rem_topupOnly;
      for (let iter = 0; iter < 50; iter++) {
        const midRem = 0.5 * (lowRem + highRem);
        const testMix = computeCompositeDistribution([
          { weight: midRem, es: ES_curr, uc: UC_curr },
          { weight: L_design - midRem, es: ES_supply, uc: UC_supply }
        ]);
        if (isWithinSpec(testMix.es, testMix.uc)) {
          lowRem = midRem; // can keep at least midRem of old media
        } else {
          highRem = midRem; // must remove more old media
        }
      }
      const bestRem = lowRem;
      L_remove_opt = L_curr - bestRem;
      mixAfterSkim = computeCompositeDistribution([
        { weight: bestRem, es: ES_curr, uc: UC_curr },
        { weight: L_design - bestRem, es: ES_supply, uc: UC_supply }
      ]);
    }

    const L_add_modeA_recommended = L_design - (L_curr - L_remove_opt);

    const modeA = {
      modeCode: 'A',
      titleTh: 'แนวทาง (ก): เติมสารกรองตามสเปก Design ให้ได้ระดับเดิม (+ วิเคราะห์การปาดเปลี่ยน)',
      supplySpec: { es: ES_supply, uc: UC_supply },
      topupOnly: {
        ...quantifyMedia(L_add_topupOnly, L_excess_raw),
        finalDepthM: L_design,
        mixES: mixTopupOnly.es,
        mixUC: mixTopupOnly.uc,
        mixD60: mixTopupOnly.d60,
        mixD90: mixTopupOnly.d90,
        mixLdRatio: (L_design * 1000.0) / mixTopupOnly.es,
        withinSpec: topupOnlyPass
      },
      recommendedWithSkim: {
        ...quantifyMedia(L_add_modeA_recommended, L_remove_opt),
        remainingOldDepthM: L_curr - L_remove_opt,
        finalDepthM: L_design,
        mixES: mixAfterSkim.es,
        mixUC: mixAfterSkim.uc,
        mixD60: mixAfterSkim.d60,
        mixD90: mixAfterSkim.d90,
        mixLdRatio: (L_design * 1000.0) / mixAfterSkim.es,
        requiresSkimming: L_remove_opt > L_excess_raw + 0.005,
        withinSpec: isWithinSpec(mixAfterSkim.es, mixAfterSkim.uc)
      }
    };

    // -----------------------------------------------------------------------
    // MODE B: คำนวณสเปกสารกรองใหม่ (ES_new, UC_new) เพื่อผสม (Blend) กับของเดิมให้ตรงตาม Design
    // -----------------------------------------------------------------------
    let modeB;
    if (L_add_topupOnly <= 0.005) {
      // No missing depth to add unless we skim first
      modeB = {
        modeCode: 'B',
        titleTh: 'แนวทาง (ข): คำนวณสเปกสารกรองใหม่ (Custom Blend) เพื่อดึงค่าเฉลี่ยกลับสู่ Design',
        feasibleWithoutSkim: false,
        reasonTh: 'ระดับสารกรองปัจจุบันเต็มระดับ Design อยู่แล้ว หากต้องการปรับแก้ขนาด ES/UC ต้องปาดสารกรองเดิมออกบางส่วนก่อนเติม',
        theoreticalSpec: { es: ES_design, uc: UC_design },
        practicalSpec: { es: ES_design, uc: UC_design },
        resultingMix: mixTopupOnly,
        quantities: quantifyMedia(0, L_excess_raw)
      };
    } else {
      const wOld = L_rem_topupOnly / L_design;
      const wNew = L_add_topupOnly / L_design;

      const d10Target = ES_design;
      const d60Target = ES_design * UC_design;

      const fOld10 = logNormalPassing(d10Target, ES_curr, UC_curr);
      const fOld60 = logNormalPassing(d60Target, ES_curr, UC_curr);

      const p1Raw = (0.10 - wOld * fOld10) / wNew;
      const p2Raw = (0.60 - wOld * fOld60) / wNew;

      let exactFeasible = p1Raw > 0.005 && p2Raw < 0.995 && p2Raw - p1Raw > 0.05;
      let theoES = ES_design;
      let theoUC = UC_design;

      if (exactFeasible) {
        const z1 = normalInv(p1Raw);
        const z2 = normalInv(p2Raw);
        const sigmaNew = Math.log(UC_design) / (z2 - z1);
        const muNew = Math.log(d10Target) - z1 * sigmaNew;
        theoUC = Math.exp(DELTA_Z_60_10 * sigmaNew);
        theoES = Math.exp(muNew + Z_10 * sigmaNew);
        if (theoUC < 1.15 || theoUC > 2.2 || theoES < 0.2 || theoES > 3.5) {
          exactFeasible = false;
        }
      }

      // Constrained commercial optimization: find (ES_new in [0.35, 2.50], UC_new in [1.28, 1.70])
      // that minimizes squared relative error of (ES_mix vs ES_design) and (UC_mix vs UC_design)
      const commUCMin = 1.28; // Lowest practical commercial UC per AWWA 6th Ed. p. 10.17 (~1.3-1.4)
      const commUCMax = 1.70;
      const commESMin = layerConfig.type === 'anthracite' ? 0.80 : 0.40;
      const commESMax = layerConfig.type === 'anthracite' ? 2.40 : 1.50;

      let bestES = Math.max(commESMin, Math.min(commESMax, theoES));
      let bestUC = Math.max(commUCMin, Math.min(commUCMax, theoUC));
      let bestLoss = Infinity;

      // Coarse-to-fine grid search for robust global optimum
      for (let esStep = commESMin; esStep <= commESMax; esStep += 0.02) {
        for (let ucStep = commUCMin; ucStep <= commUCMax; ucStep += 0.03) {
          const m = computeCompositeDistribution([
            { weight: wOld, es: ES_curr, uc: UC_curr },
            { weight: wNew, es: esStep, uc: ucStep }
          ]);
          const errES = (m.es - ES_design) / ES_design;
          const errUC = (m.uc - UC_design) / UC_design;
          const loss = 4.0 * errES * errES + errUC * errUC;
          if (loss < bestLoss) {
            bestLoss = loss;
            bestES = esStep;
            bestUC = ucStep;
          }
        }
      }

      // Fine local refinement around bestES, bestUC
      for (let dEs = -0.025; dEs <= 0.025; dEs += 0.002) {
        for (let dUc = -0.03; dUc <= 0.03; dUc += 0.005) {
          const candES = Math.max(commESMin, Math.min(commESMax, bestES + dEs));
          const candUC = Math.max(commUCMin, Math.min(commUCMax, bestUC + dUc));
          const m = computeCompositeDistribution([
            { weight: wOld, es: ES_curr, uc: UC_curr },
            { weight: wNew, es: candES, uc: candUC }
          ]);
          const errES = (m.es - ES_design) / ES_design;
          const errUC = (m.uc - UC_design) / UC_design;
          const loss = 4.0 * errES * errES + errUC * errUC;
          if (loss < bestLoss) {
            bestLoss = loss;
            bestES = candES;
            bestUC = candUC;
          }
        }
      }

      const practicalMix = computeCompositeDistribution([
        { weight: wOld, es: ES_curr, uc: UC_curr },
        { weight: wNew, es: bestES, uc: bestUC }
      ]);

      const practicalWithinSpec = isWithinSpec(practicalMix.es, practicalMix.uc);

      modeB = {
        modeCode: 'B',
        titleTh: 'แนวทาง (ข): เลือกสเปกสารกรองใหม่ (Custom Blend) เพื่อผสมกับของเดิมให้ได้ตาม Design',
        feasibleWithoutSkim: exactFeasible && theoUC >= commUCMin && theoUC <= commUCMax,
        practicalWithinSpec: practicalWithinSpec,
        theoreticalSpec: {
          es: exactFeasible ? theoES : bestES,
          uc: exactFeasible ? theoUC : bestUC
        },
        practicalSpec: {
          es: bestES,
          uc: bestUC
        },
        resultingMix: {
          mixES: practicalMix.es,
          mixUC: practicalMix.uc,
          mixD60: practicalMix.d60,
          mixD90: practicalMix.d90,
          mixLdRatio: (L_design * 1000.0) / practicalMix.es,
          cdf: practicalMix.cdf
        },
        quantities: quantifyMedia(L_add_topupOnly, L_excess_raw),
        reasonTh: practicalWithinSpec
          ? `สามารถสั่งซื้อสารกรองสเปกพิเศษ ES = ${bestES.toFixed(2)} มม., UC = ${bestUC.toFixed(2)} เติมทับได้ทันทีโดยไม่ต้องลอกของเดิม`
          : `เนื่องจากสารกรองเดิมเหลืออยู่ในสัดส่วนสูง (${(wOld * 100).toFixed(0)}%) และมีค่าเพี้ยนไปมาก การใช้สเปกที่มีขายจริงในท้องตลาด (ES = ${bestES.toFixed(2)} มม., UC = ${bestUC.toFixed(2)}) จะดึงค่าผสมมาได้ที่ ES = ${practicalMix.es.toFixed(2)} มม., UC = ${practicalMix.uc.toFixed(2)}`
      };
    }

    // -----------------------------------------------------------------------
    // MODE C: ปรับระดับความลึกชดเชยตามสัดส่วน L/d_e (Filtration Capacity Equivalence)
    // -----------------------------------------------------------------------
    // Goal: Find L_add of new media (ES_supply, UC_supply) on top of L_curr (ES_curr, UC_curr)
    // such that the composite bed achieves the Design L/d_e capacity!
    // We solve: ((L_curr + L_add) * 1000) / ES_mix(L_add) * (UC_design / UC_mix(L_add))^0.25 = R_design
    let lowAddC = 0.0;
    let highAddC = L_design * 1.8;
    for (let iter = 0; iter < 50; iter++) {
      const midAdd = 0.5 * (lowAddC + highAddC);
      const totalD = L_curr + midAdd;
      if (totalD <= 1e-5) {
        lowAddC = midAdd;
        continue;
      }
      const m = computeCompositeDistribution([
        { weight: L_curr, es: ES_curr, uc: UC_curr },
        { weight: midAdd, es: ES_supply, uc: UC_supply }
      ]);
      // Effective L/d_e with slight UC stratification penalty
      const ucPenalty = Math.pow(UC_design / m.uc, 0.25);
      const effLd = ((totalD * 1000.0) / m.es) * ucPenalty;
      if (effLd < R_design) {
        lowAddC = midAdd;
      } else {
        highAddC = midAdd;
      }
    }

    const L_add_modeC = 0.5 * (lowAddC + highAddC);
    const L_total_modeC = L_curr + L_add_modeC;
    const mixModeC = computeCompositeDistribution([
      { weight: L_curr, es: ES_curr, uc: UC_curr },
      { weight: L_add_modeC, es: ES_supply, uc: UC_supply }
    ]);

    // Also compute simple additive L/d10 equivalence: (L_curr*1000/ES_curr) + (L_add*1000/ES_supply) = R_design
    const missingLd = Math.max(0, R_design - R_current);
    const L_add_simpleLd = (missingLd * ES_supply) / 1000.0;

    const modeC = {
      modeCode: 'C',
      titleTh: 'แนวทาง (ค): ปรับระดับความลึกชดเชยตามสัดส่วน L/d_e เพื่อรักษาสมรรถนะการกรอง',
      designLdRatio: R_design,
      currentLdRatio: R_current,
      ldDeficitPercent: Math.max(0, ((R_design - R_current) / R_design) * 100.0),
      equivalentTotalDepthM: L_total_modeC,
      depthDiffFromDesignCm: (L_total_modeC - L_design) * 100.0,
      simpleAdditiveDepthAddM: L_add_simpleLd,
      mixES: mixModeC.es,
      mixUC: mixModeC.uc,
      mixD60: mixModeC.d60,
      mixD90: mixModeC.d90,
      achievedLdRatio: (L_total_modeC * 1000.0) / mixModeC.es,
      quantities: quantifyMedia(L_add_modeC, 0),
      exceedsDesignDepthWarning: L_total_modeC > L_design * 1.10
    };

    return {
      layerType: layerConfig.type,
      layerNameTh: layerConfig.nameTh,
      layerNameEn: layerConfig.nameEn,
      design: {
        depthM: L_design,
        es: ES_design,
        uc: UC_design,
        d50: designDist.d50,
        d60: designDist.d60,
        d90: designDist.d90,
        ldRatio: R_design,
        bulkDensity: rhoBulk,
        particleDensity: layerConfig.particleDensity,
        porosity: layerConfig.porosity
      },
      current: {
        depthM: L_curr,
        missingDepthM: L_missing_raw,
        missingDepthCm: L_missing_raw * 100.0,
        es: ES_curr,
        uc: UC_curr,
        d50: currentDist.d50,
        d60: currentDist.d60,
        d90: currentDist.d90,
        ldRatio: R_current
      },
      allowances: {
        skimmingAllowancePct,
        compactionAllowancePct,
        totalAllowanceFactor
      },
      modeA,
      modeB,
      modeC
    };
  }

  // =========================================================================
  // 5. FLEXIBLE REVERSE DESIGN & FILTRATION RATE SOLVER
  //    (กรอก ความลึก L, UC, Filtration Rate 10-12 m/h เพื่อหา ES หรือตัวแปรอื่นๆ)
  // =========================================================================

  /**
   * Solve for Optimal Effective Size (ES) given:
   * - Media Type ('sand' | 'anthracite')
   * - Layer Depth L (m)
   * - Uniformity Coefficient UC
   * - Filtration Rate v_F (m/h) (e.g., 10 - 12 m/h)
   * - Available Head Loss H_T (mWC) (e.g., 1.8 - 2.4 m)
   * - Max Available Backwash Rate V_BW (m/h) (e.g., 40 - 55 m/h)
   * - Water Temperature T (°C) (e.g., 28 °C)
   * - Influent Solids / Floc Loading C_0 (mg/L) (e.g., 2.5 mg/L from clarifier effluent < 5 NTU)
   * - Target L/d_e Ratio (optional, defaults to Kawamura / MWH criteria adjusted for v_F and UC)
   */
  function solveOptimalESForConditions(params) {
    const {
      mediaType = 'sand',
      layerRole = null, // 'single_sand' | 'dual_anthracite' | 'dual_sand' | 'single_anthracite'
      depthM = 1.20,
      uc = 1.40,
      filtrationRateMph = 11.0,
      availableHeadM = 2.00,
      maxBackwashRateMph = 45.0,
      tempC = 28.0,
      influentSolidsMgL = 2.5,
      minRunTimeHours = 24.0,
      targetLdRatioBase = null
    } = params;

    const L = Math.max(0.20, Number(depthM) || 1.0);
    const safeUC = Math.max(1.10, Math.min(2.50, Number(uc) || 1.40));
    const vF = Math.max(2.0, Math.min(35.0, Number(filtrationRateMph) || 11.0));
    const HT = Math.max(0.80, Number(availableHeadM) || 2.0);
    const vBW = Math.max(15.0, Number(maxBackwashRateMph) || 45.0);
    const C0 = Math.max(0.5, Number(influentSolidsMgL) || 2.5);

    const isAnthracite = mediaType === 'anthracite';
    const effectiveRole =
      layerRole ||
      (isAnthracite ? (L >= 1.2 ? 'single_anthracite' : 'dual_anthracite') : L >= 0.95 ? 'single_sand' : 'dual_sand');

    const layerProps = {
      type: mediaType,
      particleDensity: isAnthracite ? 1600 : 2650,
      porosity: isAnthracite ? 0.50 : 0.43,
      sphericity: isAnthracite ? 0.55 : 0.78,
      erKv: isAnthracite ? 228.0 : 112.5,
      erKi: isAnthracite ? 4.4 : 2.25
    };

    // 1. Kawamura (2000) & Lawler/Nason (2006) L/d_e Criterion adjusted for UC and Filtration Rate:
    // At reference v_F,ref = 11.0 m/h and UC_ref = 1.40:
    // - Single-Media Sand (Mahasawat Ph 1&2: L=1.2m, ES=0.95mm): L/d10 = 1263
    // - Dual-Media Sand layer (Ph 3: L=0.7m, ES=0.95mm -> L/d10=737; Ph 4: L=0.6m, ES=0.66mm -> L/d10=909)
    // - Dual-Media Anthracite layer (Ph 3: L=0.8m, ES=1.55mm -> L/d10=516; Ph 4: L=0.6m, ES=1.30mm -> L/d10=462)
    let defaultBaseLd = 1250;
    let referenceUC = 1.40;
    if (effectiveRole === 'dual_anthracite') {
      defaultBaseLd = L >= 0.75 ? 516 : 462;
      referenceUC = L >= 0.75 ? 1.50 : 1.40;
    } else if (effectiveRole === 'dual_sand') {
      defaultBaseLd = L >= 0.65 ? 737 : 909;
      referenceUC = 1.50;
    } else if (effectiveRole === 'single_anthracite') {
      defaultBaseLd = 1250;
      referenceUC = 1.40;
    } else {
      defaultBaseLd = 1263;
      referenceUC = 1.40;
    }

    if (targetLdRatioBase && Number(targetLdRatioBase) > 100) {
      defaultBaseLd = Number(targetLdRatioBase);
    }

    // Effect of filtration rate v_F and UC on required L/d10:
    // Higher v_F increases required L/d10 by (v_F / 11.0)^0.35 (Ives & Sholji / Lawler)
    // Higher UC increases effective grain diameter d_60 = d_10 * UC, so ES is adjusted by (UC_ref / UC)^0.35
    const velocityFactor = Math.pow(vF / 11.0, 0.35);
    const ucStratificationFactor = Math.pow(safeUC / referenceUC, 0.35);
    const requiredLdAdjusted = defaultBaseLd * velocityFactor * ucStratificationFactor;
    const esFromLdCriterion = (L * 1000.0) / requiredLdAdjusted;

    // 2. Backwash Fluidization Upper Bound (ES_max,backwash):
    // In air-scour assisted filters (like Mahasawat Phases 1-4), air scour agitates the entire bed first,
    // and water rinse is sized to fluidize the d60 grain size: V_mf(d_60) <= v_BW.
    const d90Multiplier = Math.pow(10, 1.67 * Math.log10(safeUC));
    let lowD60 = 0.2;
    let highD60 = 6.0;
    for (let iter = 0; iter < 45; iter++) {
      const midD60 = 0.5 * (lowD60 + highD60);
      const mf = calculateMinimumFluidizationVelocity(midD60, layerProps.particleDensity, tempC);
      if (mf.vMfMph <= vBW * 1.12) {
        lowD60 = midD60;
      } else {
        highD60 = midD60;
      }
    }
    const maxD60Fluidizable = 0.5 * (lowD60 + highD60);
    const esMaxBackwash = maxD60Fluidizable / safeUC;

    // 3. Washout Lower Bound (ES_min,washout):
    let lowD10 = 0.15;
    let highD10 = 3.0;
    for (let iter = 0; iter < 45; iter++) {
      const midD10 = 0.5 * (lowD10 + highD10);
      const vt = calculateTerminalSettlingVelocity(
        midD10,
        layerProps.particleDensity,
        layerProps.sphericity,
        tempC
      );
      if (vt.vTMph < vBW * 1.05) {
        lowD10 = midD10;
      } else {
        highD10 = midD10;
      }
    }
    const esMinWashout = 0.5 * (lowD10 + highD10);

    // 4. MWH Phenomenological Run-Time Optimization Model (MWH Example 11-7, Eq. 11-62 & 11-65, Fig. 11-13)
    const curvePoints = [];
    let esOptimumRunTime = esFromLdCriterion;
    let maxRunTime = 0;
    let esMinHeadLoss = isAnthracite ? 0.80 : 0.45;

    const ucHeadLossPenalty = Math.pow(safeUC / referenceUC, 0.45);
    const ucBreakthroughPenalty = Math.pow(safeUC / referenceUC, 0.30);

    // Calibrate phenomenological breakthrough & head loss rate constants (MWH Eq. 11-62 & 11-65)
    // anchored to the reference filtration configuration (vF_ref = 11 m/h, T = 28°C, target run = 40 h)
    const refES = (L * 1000.0) / defaultBaseLd;
    const refCB = calculateCleanBedHeadLoss(layerProps, L, refES, referenceUC, 11.0, 28.0);
    const refNetHead = Math.max(0.20, HT - refCB.totalHeadLoss);
    const targetRefRunHours = 40.0;

    const kBreakthrough =
      (targetRefRunHours * 11.0 * C0) / (Math.pow(refES, -0.75) * L);
    const kHeadLoss =
      (refNetHead * L) / (targetRefRunHours * Math.pow(refES, -0.81) * 11.0 * C0);

    for (let esTest = 0.35; esTest <= 2.40; esTest += 0.02) {
      const cb = calculateCleanBedHeadLoss(layerProps, L, esTest, safeUC, vF, tempC);
      const hL0 = cb.totalHeadLoss;

      // Time to breakthrough t_B (hours) - MWH Eq. 11-62
      const dEffB = esTest * ucBreakthroughPenalty;
      const tB = (kBreakthrough * Math.pow(dEffB, -0.75) * L) / (vF * C0);

      // Time to limiting head loss t_HL (hours) - MWH Eq. 11-65
      const dEffHL = esTest / ucHeadLossPenalty;
      const netHead = Math.max(0.05, HT - hL0);
      const tHL = (netHead * L) / (kHeadLoss * Math.pow(dEffHL, -0.81) * vF * C0);

      const governingRunTime = Math.min(tB, tHL);
      const ufrv = vF * governingRunTime; // m³/m²

      if (tHL < minRunTimeHours && esTest > esMinHeadLoss) {
        esMinHeadLoss = esTest;
      }

      if (governingRunTime > maxRunTime) {
        maxRunTime = governingRunTime;
        esOptimumRunTime = esTest;
      }

      curvePoints.push({
        es: Number(esTest.toFixed(2)),
        d60: Number((esTest * safeUC).toFixed(2)),
        d90: Number((esTest * d90Multiplier).toFixed(2)),
        cleanBedHeadLoss: Number(hL0.toFixed(3)),
        tBreakthrough: Number(Math.min(140, tB).toFixed(1)),
        tHeadLoss: Number(Math.min(140, tHL).toFixed(1)),
        governingRunTime: Number(Math.min(140, governingRunTime).toFixed(1)),
        ufrv: Number(ufrv.toFixed(0)),
        ldRatio: Number(((L * 1000.0) / esTest).toFixed(0))
      });
    }

    // Combine criteria into recommended ES range and target value
    const esLowerBound = Math.max(isAnthracite ? 0.75 : 0.40, esMinHeadLoss);
    const esUpperBound = Math.min(2.20, Math.max(esLowerBound + 0.15, esMaxBackwash));
    const recommendedES = Math.max(
      esLowerBound,
      Math.min(esUpperBound, 0.65 * esFromLdCriterion + 0.35 * esOptimumRunTime)
    );

    const recDist = getLogNormalParams(recommendedES, safeUC);
    const recHeadLoss = calculateCleanBedHeadLoss(layerProps, L, recommendedES, safeUC, vF, tempC);
    const recFluidizationD60 = calculateMinimumFluidizationVelocity(
      recDist.d60,
      layerProps.particleDensity,
      tempC
    );
    const recFluidizationD90 = calculateMinimumFluidizationVelocity(
      recDist.d90,
      layerProps.particleDensity,
      tempC
    );

    return {
      inputs: {
        mediaType,
        depthM: L,
        uc: safeUC,
        filtrationRateMph: vF,
        availableHeadM: HT,
        maxBackwashRateMph: vBW,
        tempC
      },
      recommended: {
        es: recommendedES,
        esRangeMin: Math.max(esLowerBound, recommendedES * 0.93),
        esRangeMax: Math.min(esUpperBound, recommendedES * 1.07),
        d50: recDist.d50,
        d60: recDist.d60,
        d90: recDist.d90,
        ldRatio: (L * 1000.0) / recommendedES,
        cleanBedHeadLossM: recHeadLoss.totalHeadLoss,
        vMfD60Mph: recFluidizationD60.vMfMph,
        vMfD90Mph: recFluidizationD90.vMfMph,
        reqBackwashMph: recFluidizationD60.vMfMph * 1.15
      },
      criteriaBreakdown: {
        esFromLdCriterion,
        requiredLdAdjusted,
        esOptimumRunTime,
        maxRunTimeHours: maxRunTime,
        esMinHeadLoss,
        esMinWashout,
        esMaxBackwash,
        maxD60Fluidizable
      },
      filtrationRateCheck: {
        rateMph: vF,
        isStandardMahasawatRange: vF >= 10.0 && vF <= 12.6,
        assessmentTh:
          vF >= 10.0 && vF <= 12.5
            ? `อยู่ในเกณฑ์มาตรฐานของโรงงานผลิตน้ำมหาสวัสดิ์ (Design 11.0–12.0 m/h) และมาตรฐานสากลสำหรับบ่อกรองเร็วที่ใช้โพลีเมอร์ช่วยตกตะกอน (Cleasby et al., 1989; MWH Sec. 11-6: ≤ 12.5 m/h)`
            : vF < 10.0
            ? `อัตราการกรองต่ำกว่าค่า Design ปกติของมหาสวัสดิ์ (11.0–12.0 m/h) ให้ความปลอดภัยสูงต่อการทะลุของความขุ่นและยืดอายุ Filter Run`
            : `อัตราการกรองสูงกว่า 12.5 m/h มีความเสี่ยงที่แรงเฉือนของน้ำจะพัดพาตะกอนหลุดทะลุ (Particle Detachment) ตามทฤษฎี MWH Sec. 11-6 ต้องควบคุมการเติม Polymer และขนาด ES อย่างเข้มงวด`
      },
      curvePoints
    };
  }

  /**
   * Solve for Required Depth L (m) given ES, UC, and Filtration Rate v_F
   */
  function solveRequiredDepthForConditions(params) {
    const {
      mediaType = 'sand',
      esMM = 0.95,
      uc = 1.40,
      filtrationRateMph = 11.0,
      filterMode = 'single', // 'single' | 'dual_sand' | 'dual_anthracite'
      otherLayerLd = 0 // if dual media, L/d10 contributed by the other layer
    } = params;

    const es = Math.max(0.2, Number(esMM) || 0.95);
    const safeUC = Math.max(1.1, Number(uc) || 1.40);
    const vF = Math.max(2.0, Number(filtrationRateMph) || 11.0);

    // Base L/d10 requirement per Kawamura (2000) / AWWA 6th Ed. p. 10.18
    let baseTargetLd = 1200;
    if (filterMode === 'dual_sand') {
      baseTargetLd = Math.max(600, 1250 - Number(otherLayerLd || 500));
    } else if (filterMode === 'dual_anthracite') {
      baseTargetLd = Math.max(450, 1250 - Number(otherLayerLd || 750));
    } else if (es >= 1.0) {
      baseTargetLd = 1250;
    } else {
      baseTargetLd = 1000;
    }

    const velocityFactor = Math.pow(vF / 11.0, 0.35);
    const ucFactor = Math.pow(safeUC / 1.40, 0.35);
    const adjustedLd = baseTargetLd * velocityFactor * ucFactor;

    const requiredDepthM = (adjustedLd * es) / 1000.0;
    const minKawamuraDepthM = (1000 * es) / 1000.0;

    return {
      es,
      uc: safeUC,
      filtrationRateMph: vF,
      baseTargetLd,
      adjustedLd,
      requiredDepthM,
      requiredDepthCm: requiredDepthM * 100.0,
      minKawamuraDepthM
    };
  }

  return {
    PLANT_PRESETS,
    normalCDF,
    normalInv,
    getLogNormalParams,
    logNormalPassing,
    logNormalPercentile,
    computeCompositeDistribution,
    aggregateRandomSamples,
    getWaterProperties,
    calculateCleanBedHeadLoss,
    calculateMinimumFluidizationVelocity,
    calculateTerminalSettlingVelocity,
    calculateBedExpansion,
    calculateCollapsePulsingWaterRate,
    calculateLayerReplenishment,
    solveOptimalESForConditions,
    solveRequiredDepthForConditions
  };
});
