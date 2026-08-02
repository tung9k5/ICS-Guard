const SCENARIO_THRESHOLDS = {
  FIRE_TEMP: { min: 60, max: 95 },
  FIRE_SMOKE: { min: 500, max: 1000 },
  FLOOD_WATER: { min: 80, max: 100 },
  OVERHEAT_TEMP: { min: 86, max: 100 }
};

export class Sensor {
  constructor(id, type, config = {}) {
    this.id = id;
    this.type = type;
    this.config = {
      min: config.min || 0,
      max: config.max || 100,
      normalMin: config.normalMin || 20,
      normalMax: config.normalMax || 40,
      variance: config.variance || 2
    };
    this.currentValue = (this.config.normalMin + this.config.normalMax) / 2;
  }

  generate(scenario) {
    let targetMin = this.config.normalMin;
    let targetMax = this.config.normalMax;

    if (scenario === 'FIRE' && this.type === 'TEMPERATURE') {
      targetMin = SCENARIO_THRESHOLDS.FIRE_TEMP.min;
      targetMax = SCENARIO_THRESHOLDS.FIRE_TEMP.max;
    } else if (scenario === 'FIRE' && this.type === 'SMOKE') {
      targetMin = SCENARIO_THRESHOLDS.FIRE_SMOKE.min;
      targetMax = SCENARIO_THRESHOLDS.FIRE_SMOKE.max;
    } else if (scenario === 'FLOOD' && this.type === 'WATER_LEVEL') {
      targetMin = SCENARIO_THRESHOLDS.FLOOD_WATER.min;
      targetMax = SCENARIO_THRESHOLDS.FLOOD_WATER.max;
    } else if (scenario === 'OVERHEAT' && this.type === 'TEMPERATURE') {
      targetMin = SCENARIO_THRESHOLDS.OVERHEAT_TEMP.min;
      targetMax = SCENARIO_THRESHOLDS.OVERHEAT_TEMP.max;
    } else if (scenario === 'OFFLINE') {
      return null;
    }

    const step = (Math.random() - 0.5) * this.config.variance;
    this.currentValue += step;

    // Fast recovery if scenario changed
    if (this.currentValue < targetMin - 15 || this.currentValue > targetMax + 15) {
      this.currentValue = (targetMin + targetMax) / 2;
    }

    if (this.currentValue < targetMin) this.currentValue += Math.abs(step) * 2;
    if (this.currentValue > targetMax) this.currentValue -= Math.abs(step) * 2;

    this.currentValue = Math.max(this.config.min, Math.min(this.config.max, this.currentValue));

    return parseFloat(this.currentValue.toFixed(2));
  }
}
