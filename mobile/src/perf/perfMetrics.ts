// Temporary audit utility

export interface QueryMetric {
  entity: string;
  rows: number;
  serializedBytes: number;
  dbTimeMs: number;
  serializationTimeMs: number;
}

class PerfMetrics {
  private bridgeMetrics: QueryMetric[] = [];
  
  measureQuery(metric: QueryMetric) {
    if (__DEV__) {
      this.bridgeMetrics.push(metric);
      const kb = Math.round(metric.serializedBytes / 1024);
      console.log(`[QUERY_METRIC] ${metric.entity.padEnd(20)} | ${String(metric.rows).padStart(4)} rows | ${String(kb).padStart(5)} KB | db: ${metric.dbTimeMs.toFixed(1)}ms | bridge: ${metric.serializationTimeMs.toFixed(1)}ms`);
    }
  }

  dump() {
    console.log(JSON.stringify(this.bridgeMetrics, null, 2));
  }
}

export const perfMetrics = new PerfMetrics();
