import { defineEval } from "eve/evals";

export default defineEval({
  description: "销售分析请求应加载对应 Skill 并通过只读 Toolbox 查询。",
  tags: ["operations", "toolbox"],
  async test(t) {
    await t.send(
      "分析 2026-06-01 到 2026-06-30 的每日销售趋势，并说明 GMV、退款和净销售口径。",
    );

    t.succeeded();
    t.loadedSkill("ecommerce-sales-analysis");
    t.calledTool("toolbox__summarize-ecommerce-sales-by-day");
    t.noFailedActions();
  },
});
