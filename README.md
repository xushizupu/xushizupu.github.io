# 许氏宗谱 · 世系图谱（GitHub Pages）

纯静态单页应用：`index.html` 从 `data.json` 加载族谱数据，部署在 GitHub Pages 上，无需后端。

## 文件说明

| 文件 | 作用 | 需要手动编辑吗 |
|---|---|---|
| `source.csv` | 族谱数据源（也可用 `source.xlsx`），用 Excel/WPS 编辑 | ✅ 日常只改这个 |
| `build.py` | 构建脚本：把源文件转成线上用的 `data.json` | ❌ 不用改 |
| `build.bat` | Windows 双击运行构建脚本 | ❌ 不用改 |
| `data.json` | 线上页面实际加载的数据（自动生成） | ❌ 不用手改，生成后提交即可 |
| `index.html` | 页面本身 | 一般不用动 |

## 日常更新流程（3 步）

1. 用 Excel 打开 `source.csv`（或 `source.xlsx`），增删改族谱数据后保存；
2. 运行构建：
   - Windows：双击 `build.bat`；或命令行执行 `python build.py`
   - 如需指定文件：`python build.py 我的族谱.xlsx`
3. 把改动提交到 GitHub（`source.csv/xlsx`、`data.json` 都提交），推送后 GitHub Pages 自动更新。


## 在线提交 + 管理后台（可选功能）

- **族人自助提交**：页面右上角"📝 提交信息"，族人填表提交，写入"提交箱"待审核。
- **管理后台**：页面右上角"🔧 管理后台"（或访问 `#admin`），可审核通过/拒绝提交、在线增删改族谱（source.csv）、导出 CSV。
- **与 Excel 批量维护并存**：线上后台写入的是 `source.csv`，和你在 Excel 里改的是同一个文件；GitHub Actions 都会自动重建 `data.json`。
- 配置 Token 与使用说明见 **SETUP.md**（含安全须知与常见问题）。
## 自动构建（GitHub Actions）

仓库已包含 `.github/workflows/build.yml`：只要把 `source.csv`（或 `source.xlsx`）推送到 GitHub，
Actions 会自动运行 `build.py` 并提交新的 `data.json`，网站随即更新——本地可以完全不用装 Python。

> 只需记住：**改数据 → 推送 `source.csv/xlsx` → 完成**。
> 手动触发也可在 GitHub 仓库的 Actions 页面点 "Run workflow"。

> 表头固定为：`姓名,性别,生,卒,配偶,父亲,字辈,职业,葬于,备注`
> 生/卒 填数字年份即可；未知可填“？”或留空。

## 2 万条数据下的设计要点

- **数据外置**：页面只负责展示，数据单独放 `data.json`，可缓存、可独立更新；
- **名录分页**：每批加载 100 条，点“加载更多”继续，不会一次性渲染几万个节点；
- **搜索防抖**：输入停顿 250ms 才搜索，且使用预建的小写索引，不卡输入；
- **ID 关联**：自动生成唯一 `id` 和 `fatherId`，同名族人不串线；
- **HTML 转义**：所有字段输出前转义，防止内容破坏页面或注入脚本；
- **世系图缓存**：同一人的上下三代只计算一次；
- **深链**：`https://你的域名/#p-5` 可直接打开某位族人。

## 常见问题

- **提示“父亲不存在”**：说明某人的“父亲”姓名在数据里找不到，通常是姓名写法不一致（如多了空格/辈分字），修正源文件后重新构建即可。
- **同名族人**：会输出警告，构建时按“第一个”同名者建立父子关系；页面展示/跳转全部按唯一 id，不受影响。
- **Excel 打开 CSV 中文乱码**：本仓库的 `source.csv` 是 UTF-8 带 BOM 格式，Excel 可直接识别；请勿另存为 GBK/ANSI。
- **没有 Python**：装 [Python 3](https://www.python.org/downloads/) 并勾选 Add to PATH，或改用 `source.xlsx` + 让有 Python 的电脑跑一次构建。
- **页面上的“本地数据预览”按钮**：仅用于临时预览你自己的 Excel/CSV，数据不会保存到线上；线上数据永远来自 `data.json`。