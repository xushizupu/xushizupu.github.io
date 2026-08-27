# 配置指南：在线提交 + 管理后台（SETUP）

本套功能完全基于 GitHub Pages 静态托管 + GitHub API，不需要服务器。你只需要创建两个受限 Token，填进代码后提交即可。

## 需要准备的两个 Token

| Token | 用途 | 权限范围 | 放哪里 |
|---|---|---|---|
| 提交 Token | 族人通过页面表单提交信息（写入提交箱） | 只能写"提交箱仓库"的 Contents | 写进 `index.html` 的 `SUBMIT_CONFIG`（公开，可接受） |
| 管理 Token | 你在后台审核、在线编辑族谱 | 读写"站点仓库"的 Contents | 后台登录时输入，只存在你自己浏览器里 |

> 强烈建议建一个单独的**提交箱仓库**（如 `xushizupu-submissions`，私有即可），让提交 Token 只碰这个"垃圾箱"仓库。即使 Token 泄露，别人也只能往里塞待审条目，动不了正式数据。

## 第一步：创建提交箱仓库（推荐）

1. GitHub → New repository → 名称如 `xushizupu-submissions` → Private → Create
2. 建好后无需放任何文件

## 第二步：创建两个 Fine-grained Token

1. GitHub 右上角头像 → Settings → Developer settings（左侧最下面）→ Personal access tokens → **Fine-grained tokens** → Generate new token
2. 填写：名称（如 `submit-token`）、有效期
3. **Repository access** 选 **Only select repositories**：
   - 提交 Token：只勾选 `xushizupu-submissions`
   - 管理 Token：勾选站点仓库 `xushizupu.github.io` 和 `xushizupu-submissions`
4. **Permissions → Repository permissions → Contents** 选 **Read and write**
5. Generate token，**立即复制**（只显示一次）

## 第三步：把提交 Token 填进 index.html

用编辑器打开 `index.html`，找到文件开头的这一段（在 `<script>` 里）：

```js
const SUBMIT_CONFIG = {
  submitOwner: 'xushizupu',      // 提交箱仓库 owner（与站点同账号就填 xushizupu）
  submitRepo: 'xushizupu-submissions',  // 提交箱仓库名
  submitToken: 'github_pat_这里粘贴你的提交Token'
};
```

保存后提交推送到 GitHub，页面即可使用提交功能。

## 第四步：使用管理后台

1. 打开网站，点右上角 **🔧 管理后台**（或直接访问 `https://xushizupu.github.io/#admin`）
2. 填写：站点仓库 Owner（`xushizupu`）、仓库名（`xushizupu.github.io`）、管理 Token
3. 点 **登录**，即可看到：
   - **📥 待审核提交**：族人提交的信息，点"通过并录入"自动写入 `source.csv`（GitHub Actions 会自动重建网站数据）；"拒绝"则丢弃
   - **📖 在线编辑族谱**：直接增删改表格，点"保存到 GitHub"写入 source.csv；"导出 CSV"可下载后用 Excel 批量维护
4. Token 只保存在你浏览器里；换电脑/清缓存后重新输入即可

## 想先本地试用？

打开页面时加 `?mock=1`（如 `http://127.0.0.1:8765/?mock=1`），或后台登录页点 **"演示模式"**——所有写入只存在本机浏览器里，不会真正上传，适合先体验流程。

## 安全须知（务必读）

- **提交 Token 是公开的**（在网页源码里），所以必须用独立提交箱仓库 + 最小权限。定期在 GitHub 上轮换（重新生成）更安心。
- **管理 Token 绝不能写进网页代码**，只在你自己浏览器输入。
- 后台审核请人工核对"父亲姓名是否在族谱中、是否重名"后再通过；`build.py` 也会自动给出警告。
- JSON 文件不是真正数据库：多人同时提交偶尔会冲突，已做自动重试；极端情况以最后一次写成功为准。

## 常见问题

- **提交后看不到**：提交箱在独立仓库，后台读取的是同一个仓库，检查 `SUBMIT_CONFIG.submitRepo` 是否与管理后台登录的站点仓库一致（或故意设置一致）。
- **保存提示"仓库中没有 source.csv"**：先把项目里的 `source.csv` 提交到站点仓库；或直接在后台点"新增一行"后保存（会自动创建该文件）。
- **提示 403/404**：Token 权限不足或仓库名写错。检查 Fine-grained token 的 Repository access 与 Contents: Read and write。