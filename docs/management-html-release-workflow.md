# management.html 协作与 Release 流程

## 当前推荐模式
- 单人开发，长期只保留 `main` 分支。
- 平时直接在 `main` 提交源码。
- 发布时通过 Git tag 触发 GitHub Release 自动构建并上传 `dist/management.html`。

## 一次性初始化
在每个本地仓库克隆中执行一次：

```bash
npm run setup:merge-driver
```

它会在当前仓库的本地 Git 配置里注册一个 merge driver：
- 当 `dist/management.html` 在合并中两边都被修改时，默认保留当前分支版本。
- 这样可以避免反复手工处理这个构建产物的冲突。

可用下面的命令检查是否已配置：

```bash
npm run check:merge-driver
```

## 本地分支迁移
如果当前仓库还在使用 `dev`，推荐迁移到 `main`：

```bash
git branch -m dev main
git push -u origin main
```

然后在 GitHub 仓库设置中：
- 将默认分支切换为 `main`
- 确认外部面板拉取逻辑已指向新的默认分支
- 确认无误后再删除远端 `dev`

```bash
git push origin --delete dev
```

## 推荐开发流程
1. 日常只改源码并直接提交到 `main`
2. 需要更新产物时执行：

```bash
npm run build
```

3. 如需提交最新产物，再提交 `dist/management.html`

## Release 流程
仓库已配置 GitHub Actions：
- 当推送 `v*` 标签时自动执行构建
- 自动将 `dist/management.html` 上传到 GitHub Release

示例：

```bash
git tag v1.1.8
git push origin v1.1.8
```

## 注意事项
- merge driver 只对当前本地仓库生效；其他协作者也需要执行一次 `npm run setup:merge-driver`
- 该策略适合构建产物文件，不适合源码文件
- 本地分支改成 `main` 后，在执行 `git push -u origin main` 之前，当前 upstream 仍可能暂时显示为 `origin/dev`
