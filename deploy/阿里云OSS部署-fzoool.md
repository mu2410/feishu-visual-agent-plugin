# 阿里云部署步骤（域名 fzoool.com）

把 `npm run build` 生成的 **dist** 挂到阿里云，供飞书加载。  
建议用子域名，例如：**`https://feishu.fzoool.com`**（不要占用主站根域名）。

---

## 第一步：创建 OSS 存储桶

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. **Bucket 列表** → **创建 Bucket**
3. 建议配置：

| 项 | 建议值 |
| --- | --- |
| Bucket 名称 | `fzoool-feishu-plugin`（全局唯一，可自定） |
| 地域 | 选离团队近的（如华东1） |
| 存储类型 | 标准存储 |
| 读写权限 | **公共读**（静态网站必须能被飞书访问） |
| 版本控制 | 关闭即可 |

4. 创建完成后，进入该 Bucket

---

## 第二步：开启静态网站托管

1. Bucket 内左侧 → **数据管理** → **静态页面**
2. **设置** → 开启静态网站托管
3. **默认首页**：`index.html`
4. **默认 404 页**（可选）：`index.html`（与 Vite 单页一致）
5. 保存

记下页面里给出的 **访问 Endpoint**（测试用，后面会用自定义域名）。

---

## 第三步：上传 dist 文件

在你电脑上项目目录已执行过：

```bash
npm run build
```

上传方式任选一种：

### 方式 A：控制台网页上传（最简单）

1. Bucket → **文件管理** → **上传文件**
2. 进入本地 `dist` 文件夹，**全选**里面的 `index.html` 和 `assets` 文件夹
3. 上传到 Bucket **根目录**（不要多一层 `dist` 目录）

上传后结构必须是：

```
Bucket 根目录/
  index.html
  assets/
    index-xxxxx.js
    index-xxxxx.css
    ...
```

### 方式 B：ossutil 命令行

安装 [ossutil](https://help.aliyun.com/document_detail/120075.html) 后：

```bash
ossutil cp -r dist/ oss://你的Bucket名称/ --update
```

---

## 第四步：绑定自定义域名 + HTTPS

1. Bucket → **传输管理** → **域名管理** → **绑定域名**
2. 填写：**`feishu.fzoool.com`**（子域名可自定）
3. 按提示完成 **域名所有权验证**（TXT 记录，控制台会给值）
4. 开启 **自动添加 CNAME 记录**（若提示）或到域名解析手动添加
5. 开启 **HTTPS**：
   - 可选 **CDN 加速域名**（推荐，便于免费证书）
   - 或在 **SSL 证书** 服务申请免费证书并绑定

> 飞书要求 **HTTPS**，务必等证书生效后再测。

---

## 第五步：域名解析（你截图里的「解析」）

1. 打开 [域名控制台](https://dc.console.aliyun.com/) → **域名列表** → `fzoool.com` → **解析**
2. **添加记录**：

| 记录类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| CNAME | `feishu` | OSS 域名管理里显示的 CNAME 地址（一长串 `.aliyuncs.com`） |

若第四步已勾选自动添加，可能已有记录，检查即可。

3. 等待 **5～30 分钟** 生效

---

## 第六步：浏览器自测

打开：

```
https://feishu.fzoool.com/index.html
```

应看到插件界面（标题「视觉Agent」等）。  
若空白：F12 → Network，看 `assets/*.js` 是否 404（多半是上传路径多了一层目录）。

---

## 第七步：填入飞书多维表格

1. 打开团队用的多维表格
2. **插件** → **自定义插件** → **+ 新增插件**
3. **运行地址**：

```
https://feishu.fzoool.com/index.html
```

4. 确定后 **复制插件链接** 发给同事
5. 同事各自在插件 **设置** 里填写 Grsai API Key

---

## 以后更新插件

```bash
npm run build
```

重新上传覆盖 Bucket 里同名文件即可（`index.html` + 整个 `assets` 文件夹）。  
同事刷新飞书插件面板，无需重新添加插件。

---

## 费用与安全（团队内部）

- OSS 流量、存储费用通常很低（按量）
- Bucket 设为「公共读」仅表示 **网页文件可被访问**，不含你们表格数据
- API Key 仍在各同事浏览器里，不要写进上传的文件
- 若只想公司内访问：可在 Bucket **防盗链** 里限制 Referer（飞书 iframe 需测试是否放行）

---

## 常见问题

**CNAME 和 A 记录冲突？**  
同一主机记录 `feishu` 只用 **CNAME** 指 OSS，不要同时配 A 记录。

**必须用子域名吗？**  
建议用 `feishu.fzoool.com`，主域名 `www.fzoool.com` 可继续作官网。

**飞书提示无法加载？**  
确认 HTTPS 证书有效；用手机 4G 试开 URL，排除内网 DNS 问题。
