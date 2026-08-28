# 配置指南：页脚"管理"后台（SETUP）

页脚那个不起眼的"管理"入口是管理员在线编辑族谱的后台：登录后可增删改 `source.csv`，保存后 GitHub Actions 自动重建 `data.json` 上线。

## 只需要一个 Token

| Token | 用途 | 权限范围 | 放哪里 |
|---|---|---|---|
| 管理 Token | 后台在线编辑族谱 | 站点仓库 `xushizupu.github.io` 的 Contents 读写 | 只在浏览器输入，绝不写进代码 |

## 创建管理 Token（一次，约 2 分钟）

1. GitHub → 头像 → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. 名称随意（如 `guanli-token`）；有效期建议选长一点（如 90 天或 Custom）
3. **Repository access** 选 **Only select repositories** → 勾选 **`xushizupu.github.io`**
4. **Permissions → Repository permissions → Contents** 选 **Read and write**
5. Generate token，**立即复制**（只显示一次）

## 使用后台

1. 打开网站，滚动到**页脚**，点那个浅色的"**管理**"链接（或直接访问 `https://xushizupu.github.io/#admin`）
2. 填写：仓库 Owner（`xushizupu`）、仓库名（`xushizupu.github.io`）、管理 Token
3. 点 **登录**，即可：
   - **在线编辑族谱**：表格分页 + 搜索，新增/修改/删除行，点"保存到 GitHub"写入 `source.csv`；
   - **导出 CSV**：下载后可用 Excel 批量维护（与在线编辑改的是同一个文件）；
4. Token 只保存在本浏览器；换电脑/清缓存后重新输入即可

## 本地试用

后台登录页点 **"演示模式（本地试用）"**，或用 `?mock=1` 打开页面——所有写入只存在本机浏览器，不会真正上传。

## 安全须知

- 管理 Token 只在你自己浏览器输入，**绝不写进任何网页文件**；
- 浏览器保存的 Token 属于"本机可信"级别：不要在公共电脑上登录后台，或登录后点"退出"清除；
- Token 到期后重新生成，并在后台重新输入。

## 常见问题

- **保存提示 `Resource not accessible by personal access token`**：管理 Token 没勾选站点仓库，或 Contents 权限不是 Read and write，按上面第 3、4 步检查后重新登录。
- **保存提示 `Bad credentials`**：Token 过期/被撤销/复制错，重新生成后重试。
- **提示"仓库中没有 source.csv"**：先在后台点"新增一行"后保存（会自动创建），或先把 `source.csv` 提交到仓库。
- **Excel 保存后中文乱码 / 构建报编码错误**：Excel 在中文系统上会把 CSV 存成 GBK。`build.py` 与后台已自动识别 GBK 和 UTF-8，无需处理；另存 CSV 时选 UTF-8 即可在 Git 中正常查看差异。
