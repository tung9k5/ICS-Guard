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

    if (this.isLoading) {
      // wait until loaded by another concurrent call
      while (this.isLoading) {
        await new Promise(r => setTimeout(r, 50));
      }
      return;
    }

    this.isLoading = true;
    try {
      this.rules = await Rule.find({ is_active: true }).lean();
      this.lastLoadTime = Date.now();
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
          this.lastLoadTime = Date.now();
          console.log(`[RuleEngine] Loaded ${this.rules.length} rules from Redis Fallback.`);
        }
      } catch (e) {}
    } finally {
      this.isLoading = false;
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
    if (!device_id || !metrics) return [];

    await this.loadRules();
    const matchedRules = [];
    const now = Date.now();

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
        const key = `rule_hits:${rule.rule_name}:${device_id}`;
        const windowMs = (rule.time_window_seconds || 60) * 1000;
        const triggerCount = rule.trigger_count || 1;

        try {
          // Add current hit timestamp to Sorted Set (value is timestamp + random nonce to allow duplicates)
          const member = `${now}_${Math.random().toString(36).substring(2, 6)}`;
          await redisClient.sendCommand(['ZADD', key, String(now), member]);

          // Prune hits older than window
          const minScore = String(now - windowMs);
          await redisClient.sendCommand(['ZREMRANGEBYSCORE', key, '-inf', `(${minScore}`]);

          // Get count of hits in window
          const countStr = await redisClient.sendCommand(['ZCARD', key]);
          const count = parseInt(countStr, 10) || 0;

          console.log(`[CorrelationEngine] Rule ${rule.rule_name} on device ${device_id} hits: ${count}/${triggerCount} (window: ${rule.time_window_seconds}s)`);

          if (count >= triggerCount) {
            matchedRules.push(rule);
            // Clear hits after trigger so it starts fresh
            await redisClient.del(key);
          }
        } catch (err) {
          console.error('[CorrelationEngine] Redis error, falling back to instant match:', err.message);
          // Fallback to instant match
          matchedRules.push(rule);
        }
      }
    }

    return matchedRules;
  }
}

const ruleEngineService = new RuleEngineService();
export default ruleEngineService;
