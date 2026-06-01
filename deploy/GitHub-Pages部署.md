# GitHub Pages 部署指南（团队内部使用）

把飞书多维表格插件发布到 **GitHub Pages**，得到一个固定的 **HTTPS 地址**，全团队填入飞书即可使用。

> 适合：不想开阿里云 OSS、有 GitHub 账号、代码可公开（免费 Pages 需公开仓库）。  
> 插件地址示例：`https://你的用户名.github.io/feishu-visual-agent-plugin/index.html`

---

## 一、准备清单

| 项目 | 要求 |
| --- | --- |
| GitHub 账号 | 已注册并登录 |
| 本机 | 已安装 [Git](https://git-scm.com/) |
| 项目 | 已在本地 `npm run build` 能成功 |
| 飞书 | 团队共用的多维表格 + Grsai API Key |

---

## 二、创建 GitHub 仓库

1. 打开 [https://github.com/new](https://github.com/new)
2. 填写：
   - **Repository name**：例如 `feishu-visual-agent-plugin`
   - **Public**（公开）：免费 GitHub Pages 必须公开仓库
   - 不要勾选 README（本地已有项目）
3. 点击 **Create repository**

记下仓库地址，例如：

```
https://github.com/你的用户名/feishu-visual-agent-plugin.git
```

---

## 三、把本地代码推送到 GitHub

在项目根目录打开终端（PowerShell）：

```powershell
cd "C:\自动化\Feishu Image Generation Plugin"

# 若尚未初始化 git
git init
git add .
git commit -m "init: 飞书生图插件"

# 关联远程仓库（改成你的地址）
git remote add origin https://github.com/你的用户名/feishu-visual-agent-plugin.git

# 主分支命名为 main（GitHub 默认）
git branch -M main
git push -u origin main
```

首次 push 时 GitHub 会要求登录（浏览器或 Personal Access Token）。

**注意：** `.gitignore` 已忽略 `node_modules`，不要提交 API Key（Key 只在同事浏览器「设置」里填）。

---

## 四、开启 GitHub Pages（自动部署）

项目已包含工作流文件：`.github/workflows/pages.yml`  
推送代码后会自动 `npm run build` 并发布 `dist/`。

### 4.1 在仓库里开启 Pages

1. 打开 GitHub 仓库 → **Settings**（设置）
2. 左侧 **Pages**
3. **Build and deployment** → **Source** 选 **GitHub Actions**（不是 Deploy from a branch）
4. 保存

### 4.2 触发第一次部署

```powershell
git add .
git commit -m "chore: 启用 GitHub Pages 部署"
git push
```

### 4.3 查看部署是否成功

1. 仓库顶部 **Actions** 标签
2. 点开最新的 **Deploy GitHub Pages** 工作流
3. 全部绿色 ✓ 即成功

### 4.4 获取访问地址

仍在 **Settings → Pages**，会显示：

```
https://你的用户名.github.io/feishu-visual-agent-plugin/
```

浏览器打开（建议加 `index.html` 测一下）：

```
https://你的用户名.github.io/feishu-visual-agent-plugin/index.html
```

应看到「飞书生图自动化 / 视觉Agent」插件界面。

---

## 五、填入飞书多维表格

1. 打开**团队共用**的多维表格
2. **插件** → **自定义插件** → **+ 新增插件**
3. **运行地址** 填（把域名和仓库名换成你的）：

```
https://你的用户名.github.io/feishu-visual-agent-plugin/index.html
```

4. 确定 → **复制插件链接** → 发到团队群

同事打开链接，或在同一张表：**插件 → 自定义插件** → 选择该插件。

---

## 六、同事各自配置（每人一次）

1. 在表格中**选中一行**
2. 插件右上角 **设置** → 填写 **Grsai API Key**
3. 在表里填好 **Prompt、参考图、比例、尺寸、模型**
4. 点 **生成图片**

表格 **状态** 单选需包含：`生成中`、`成功`、`失败`。

---

## 七、以后更新插件

你改完代码后：

```powershell
git add .
git commit -m "fix: 描述你的修改"
git push
```

GitHub Actions 会自动重新 build 并发布（约 1～3 分钟）。  
同事**刷新飞书插件面板**即可，一般**不用**重新添加插件地址。

可在 **Actions** 页查看每次部署进度。

---

## 八、（可选）绑定自己的域名

若要用 `https://feishu.fzoool.com` 而不是 `github.io`：

1. GitHub 仓库 **Settings → Pages → Custom domain** 填 `feishu.fzoool.com`
2. 到阿里云 **域名解析** 添加 **CNAME**：
   - 主机记录：`feishu`
   - 记录值：`你的用户名.github.io`（GitHub Pages 页面会显示准确 CNAME）
3. 等待 DNS 生效，GitHub 会自动申请 HTTPS 证书
4. 飞书插件地址改为：

```
https://feishu.fzoool.com/index.html
```

---

## 九、常见问题

### 1. 页面空白 / 资源 404

- Actions 是否部署成功（全绿）
- 访问 URL 是否包含正确**仓库名**（项目站路径是 `/仓库名/`）
- 不要用 `http://`，必须 **https://**

### 2. Actions 失败

- 本地先跑 `npm run build` 确认无报错
- **Actions** 里点开失败步骤看红色日志
- 确认 **Settings → Pages → Source** 选的是 **GitHub Actions**

### 3. 国内访问 GitHub Pages 慢

- 可绑国内 CDN 或改用阿里云 OSS / 公司 Nginx
- 或绑自己的域名 + CDN 加速

### 4. 不想公开代码

- 免费账号：GitHub Pages 通常需**公开仓库**
- 替代：Vercel / Cloudflare Pages（可连私有仓库）或内网 Nginx

### 5. 只有我自己 localhost 能用

- 团队必须用你部署好的 **HTTPS 地址**，不能填 `localhost`

---

## 十、流程一览

```
本地改代码 → git push → GitHub Actions 自动 build
    → 发布到 Pages（HTTPS）
    → 飞书填插件 URL → 同事打开 + 填 API Key → 生图
```

---

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `.github/workflows/pages.yml` | 自动构建、发布 |
| `vite.config.ts` 中 `base: './'` | 保证 Pages 子路径下资源能加载 |
| `dist/` | 构建产物（由 Actions 生成，无需手动上传） |
