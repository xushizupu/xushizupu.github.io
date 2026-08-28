# 许氏宗谱 · 世系图谱（GitHub Pages）

纯静态单页应用，部署在 GitHub Pages，无需后端。页面从 `data.json` 加载族谱数据。

## 文件说明

| 文件 | 作用 | 需要手动编辑吗 |
|---|---|---|
| `source.csv` | 族谱数据源（也可用 `source.xlsx`），用 Excel/WPS 编辑 | ✅ 日常只改这个 |
| `build.py` | 构建脚本：源文件 → `data.json` | ❌ 不用改 |
| `build.bat` | Windows 双击运行构建脚本 | ❌ 不用改 |
| `data.json` | 线上页面实际加载的数据（自动生成） | ❌ 提交即可 |
| `index.html` | 页面结构（纯 HTML） | 一般不用动 |
| `style.css` | 页面样式 | 一般不用动 |
| `app.js` | 页面逻辑（浏览、搜索、后台） | 一般不用动 |

## 日常更新流程

1. 用 Excel 打开 `source.csv`（或 `source.xlsx`）增删改，保存；
2. 构建：双击 `build.bat`（或 `python build.py`）；
3. 提交 `source.csv/xlsx` 和 `data.json` 到 GitHub，推送后自动上线。

> 也可以只推送 `source.csv/xlsx`——`.github/workflows/build.yml` 会自动重新生成 `data.json`。
>
> 💡 **编码提示**：Excel 在中文系统上可能把 CSV 存成 GBK/ANSI，`build.py` 和后台已自动兼容 UTF-8 与 GBK，直接可用；若想在 Git 里方便查看差异，另存时选 UTF-8 更佳。

## 页面功能

- **浏览**：搜索姓名/职业/父亲、按字辈筛选、查看详情与上三代/下三代世系图；
- **🔄 更新信息**：点击后显示管理员联系电话，需添加/更改信息请联系管理员；
- **📥 本地数据预览**：临时预览自己的 Excel/CSV（不保存）；
- **页脚"管理"入口**：管理员在线编辑族谱（需 GitHub Token，见 SETUP.md）。

## 自动构建（GitHub Actions）

推送 `source.csv` / `source.xlsx` / `build.py` 后，Actions 自动运行 `build.py` 并提交新的 `data.json`。
