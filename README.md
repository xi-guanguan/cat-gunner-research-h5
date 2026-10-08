# Cat Gunner 中文 H5 · 研究试玩版

在线试玩：https://xi-guanguan.github.io/cat-gunner-research-h5/

从 Cat Gunner 研究工作区导出的可运行快照，来源 revision：`a28afe2fd7a2be5400b94201eab68947a076f2b4`。
本仓库不包含 APK、原始取证文件、完整研究历史或用户存档。

## 开发与部署

```sh
npm ci
npm run dev
npm run build
npm run build:pages
```

推送 `main` 后 GitHub Actions 会进行 TypeScript 检查、Vite 构建、项目子路径适配、哈希清单生成和 Pages 部署。
`deployment-manifest.json` 记录每个构建文件的 SHA256、来源 revision 和部署 revision。

## 试玩

关闭/领取每日奖励后进入战场；点击场景中的树木目标射击，赚取金币，使用底部攻击/攻速/金币升级。
背包与其他玩法按正常进度解锁。存档保留在此网址的当前浏览器中，不会迁移本地预览的存档。
`debug.html` 和 `qa.html` 是独立研究夹具，不代表正常成长路径。

## 边界

这是 **WIP 在线研究预览，不是 verified 正式交付**。
真实广告、支付、云服务与原机等价验证未接入；没有真实扣费。
工作区已有 1471 项规则测试通过，但不能据此宣称全入口闭合或真人体验已验收。
