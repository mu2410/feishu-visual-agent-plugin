# IT 部署指南 · 飞书多维表格边栏插件

你是 IT，只需要完成一件事：**让同事能通过 `https://某个地址/index.html` 打开 `dist` 里的网页**。

---

## 一、先确认你手里有什么

| 已有条件 | 推荐做法 |
| --- | --- |
| Linux 服务器 + 公司子域名 | **方案 A：Nginx**（最常见） |
| Windows Server + IIS | **方案 B：IIS** |
| 只有阿里云/腾讯云，没有虚拟机 | **方案 C：对象存储静态网站** |
| 域名在 Cloudflare 管理 | **方案 D：Cloudflare Pages**（免费 HTTPS） |

下面按方案 A 详细写（Linux + Nginx），B/C 给简要步骤。

---

## 二、方案 A：Linux + Nginx（推荐）

### 1. 在本机或 CI 构建

```bash
cd "Feishu Image Generation Plugin"
npm install
npm run build
```

得到文件夹：`dist/`（里面有 `index.html` 和 `assets/`）。

### 2. 上传到服务器

在服务器上建目录并上传（示例用 scp，也可用 WinSCP、FTP）：

```bash
# 在服务器上
sudo mkdir -p /var/www/feishu-image-plugin

# 在你电脑上（PowerShell，改 IP 和路径）
scp -r dist/* user@服务器IP:/var/www/feishu-image-plugin/
```

**注意**：是复制 `dist` **里面的**文件，不是把整个 `dist` 文件夹再套一层。

上传后服务器目录应类似：

```
/var/www/feishu-image-plugin/
  index.html
  assets/
    index-xxxxx.js
    index-xxxxx.css
```

### 3. DNS

让子域名指向这台服务器，例如：

- `feishu-plugin.公司域名.com` → 服务器公网 IP（内网则填内网 IP，同事需 VPN）

### 4. HTTPS 证书

任选其一：

- 公司已有泛域名证书 → 按现有流程挂到 Nginx
- 公网服务器 → 可用 [Let's Encrypt](https://letsencrypt.org/)（certbot）

### 5. Nginx 配置

复制项目里的 `deploy/nginx.conf.example`，改三处：

- `server_name` → 你的子域名
- `ssl_certificate` / `ssl_certificate_key` → 证书路径
- `root` → `/var/www/feishu-image-plugin`

放到 `/etc/nginx/sites-available/feishu-plugin.conf`，然后：

```bash
sudo ln -s /etc/nginx/sites-available/feishu-plugin.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. 自测

浏览器打开：

```
https://feishu-plugin.公司域名.com/index.html
```

应看到「视觉Agent」界面（可能提示未选记录，正常）。

### 7. 填到飞书

多维表格 → **插件** → **自定义插件** → **+ 新增** → 运行地址：

```
https://feishu-plugin.公司域名.com/index.html
```

把插件链接发给同事即可。

---

## 三、方案 B：Windows Server + IIS

1. 安装 **IIS**，并安装 URL Rewrite 模块（可选，用于 SPA 回落）。
2. 新建网站，物理路径指向你复制过去的 `dist` 内容目录。
3. 绑定 **HTTPS**（导入公司证书，或用 IIS 申请）。
4. 确保默认文档包含 `index.html`。
5. 浏览器用 `https://你的绑定域名/index.html` 测试。
6. 同上填入飞书插件地址。

---

## 四、方案 C：阿里云 OSS 静态网站（无自己的服务器）

1. 创建 Bucket，开启 **静态网站托管**，默认首页 `index.html`。
2. 把 `dist` 内所有文件上传到 Bucket 根目录。
3. 绑定自定义域名，开启 **HTTPS（CDN 或 OSS 证书）**。
4. 访问 `https://你的自定义域名/index.html` 测试。
5. 填入飞书。

---

## 五、方案 D：Cloudflare Pages（域名已在 Cloudflare 时最快）

1. 把项目推到 Git（GitHub/GitLab 私有库即可）。
2. Cloudflare Dashboard → Pages → 连接仓库。
3. 构建命令：`npm run build`，输出目录：`dist`。
4. 绑定子域名，自动 HTTPS。
5. 得到 `https://feishu-plugin.xxx.pages.dev` 或自定义域名，填入飞书。

---

## 六、常见问题

**Q：飞书填了地址打不开？**  
- 必须是 **HTTPS**（内网自签证书有时需在飞书环境信任）。  
- 用**无痕窗口**直接打开该 URL，先确认网页能显示。

**Q：页面空白？**  
- 检查是否上传了完整 `dist`（含 `assets`）。  
- 浏览器 F12 → Network，看 JS/CSS 是否 404（路径错了常是只上传了 index 没上传 assets）。

**Q：同事要不要再 build？**  
- 不用。只有你更新插件时重新 `npm run build` 并覆盖服务器文件。

**Q：API Key 要部署到服务器吗？**  
- 不用。Key 存在每个同事浏览器「设置」里，和静态托管无关。

---

## 七、安全建议（团队内部）

- 插件页面可限制仅内网/VPN 访问（防火墙或 Nginx `allow` 内网 IP）。  
- Grsai API Key 由管理员内部文档下发，不要写进代码仓库。
