import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Eve durable session 在多轮之间保留会话上下文。",
  tags: ["session"],
  async test(t) {
    const first = await t.send("请记住校验词 marigold，只回复已记住。");
    first.expectOk();

    const second = await t.send("我刚才让你记住的校验词是什么？");
    t.succeeded();
    t.check(second.message, includes("marigold"));
  },
});
