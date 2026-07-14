import { Rule } from '../models/index.js';
import redisClient from '../config/redis.js';

class RuleEngineService {
  constructor() {
    this.rules = [];
    this.lastLoadTime = 0;
    this.CACHE_TTL = 60000; // Reload rules every 60 seconds minimum
  }

  async loadRules() {
    const now = Date.now();
    if (this.rules.length > 0 && now - this.lastLoadTime < this.CACHE_TTL) {
      return; // Use memory cache
    }

    try {
      this.rules = await Rule.find({ is_active: true }).lean();
      this.lastLoadTime = now;
      console.log(`[RuleEngine] Loaded ${this.rules.length} active rules from Database.`);
      try {
        await redisClient.setEx('active_rules', 3600, JSON.stringify(this.rules));
      } catch (e) {}
    } catch (err) {
      console.error('[RuleEngine] Error loading rules:', err.message);
      // Fallback to Redis
      try {
        const cached = await redisClient.get('active_rules');
        if (cached) {
          this.rules = JSON.parse(cached);
          this.lastLoadTime = now;
          console.log(`[RuleEngine] Loaded ${this.rules.length} rules from Redis Fallback.`);
        }
      } catch (e) {}
    }
  }

  evaluateCondition(metricValue, operator, thresholdValue) {
    if (metricValue === undefined || metricValue === null) return false;
    const mVal = Number(metricValue);
    const tVal = Number(thresholdValue);
    
    switch (operator) {
      case '>': return mVal > tVal;
      case '<': return mVal < tVal;
      case '>=': return mVal >= tVal;
      case '<=': return mVal <= tVal;
      case '==': return mVal === tVal;
      case '!=': return mVal !== tVal;
      default: return false;
    }
  }

  async evaluateTelemetry(payload) {
    const { device_id, zone, metrics } = payload;
    if (!metrics) return [];

    await this.loadRules();
    const matchedRules = [];

    for (const rule of this.rules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;
      
      // Default to AND logic for conditions within a rule
      let allConditionsMet = true;
      for (const cond of rule.conditions) {
        const metricValue = metrics[cond.field];
        const met = this.evaluateCondition(metricValue, cond.operator, cond.value);
        if (!met) {
          allConditionsMet = false;
          break;
        }
      }

      if (allConditionsMet) {
        matchedRules.push(rule);
      }
    }

    return matchedRules;
  }
}

const ruleEngineService = new RuleEngineService();
export default ruleEngineService;
