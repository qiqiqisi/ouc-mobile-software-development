# OUC Mobile Software Development

中国海洋大学 2026 夏《移动软件开发》课程实验与个人项目仓库。

本仓库用于记录课程实验代码、实验报告以及个人项目。课程实验使用独立 Git 分支管理；`main` 分支除课程导航外，目前也包含 **BUGTI Web** 及 GitHub Pages 部署配置。

---

## 🧪 BUGTI 暑期人格测试

> **当前版本：BUGTI Web v1.0.0 · 首个公开测试版本**

🌐 **在线体验：**  
https://qiqiqisi.github.io/ouc-mobile-software-development/

由于上传为微信小程序需要审批，所以建立测试网站，本网站更适合在手机上打开。欢迎直接使用手机打开测试，也欢迎反馈功能问题、显示异常或体验上的建议，反馈邮箱：wzh1661@stu.ouc.edu.cn。

所有图片均由ChatGPT参考MBTI和SBTI风格生成。

BUGTI 是一个围绕“暑期生活记录 + 阶段人格分析”设计的小项目。用户可以记录每天的状态，在积累一定记录后选择时间范围进行分析，并获得对应的 BUGTI 人格结果；同时提供今日运势、历史日历和分享等功能。

### ✨ 主要功能

- 📝 **每日记录**：记录心情、忙碌度、标签、文字和图片
- ✏️ **编辑与补记**：支持修改当天记录，也可以补记过去日期
- 🗑️ **记录删除**：可删除已有记录及对应本地图片
- 📅 **历史日历**：按月份查看记录日期和心情 Emoji
- 🧠 **人格分析**：支持最近 7 天、最近 30 天和自定义自然日范围
- 🎭 **BUGTI 人格结果**：根据记录生成对应人格、文案和人格图片
- 🔮 **今日运势**：每日抽取运势，并支持不同主题与变体
- 🔗 **分享**：支持人格结果和运势分享链接
- 📱 **移动端优先**：适配常见手机宽度，同时兼容 PC 浏览器

### 💾 数据存储说明

BUGTI Web v1.0.0 **暂时没有账号系统和云端同步**。当前记录保存在访问网站时所使用的浏览器本地。

当前主要存储方式：

- 每日记录：`localStorage`
- 人格分析报告：`localStorage`
- 今日运势状态：`localStorage`
- 记录图片：`IndexedDB`

因此需要注意：

- 正常刷新网页、关闭后重新打开同一浏览器，数据通常仍会保留。
- **微信内置浏览器和 Chrome / Edge / Safari 等外部浏览器可能使用不同的本地存储环境。** 即使打开的是同一个网址，两边的记录也可能互相看不到。
- 更换浏览器、更换设备后，原来的记录不会自动同步过去。
- 清除浏览器网站数据、缓存或本地存储，可能导致记录和图片丢失。
- 清理微信相关网页数据后，从微信中保存的记录也可能丢失。
- 无痕 / 隐私浏览模式下的数据不建议长期保存。
- 当前版本没有云端备份，请不要把重要资料只保存在 BUGTI 中。

### 📦 版本说明

**BUGTI Web v1.0.0** 是第一版公开测试版本，目前已完成主要记录、分析、人格结果、今日运势、分享和移动端适配功能。

当前已完成桌面浏览器和多种手机宽度测试。真实手机环境下的**系统相册选择**和**系统分享面板**仍建议继续进行人工测试。

后续版本会继续根据实际使用情况修复问题和调整体验。

---

## 📌 其他实验进度

| 实验   | 内容             | 分支                                                         | 状态     |
| ------ | ---------------- | ------------------------------------------------------------ | -------- |
| Lab 01 | 第一个微信小程序 | [lab01](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab01) | ✅ 已完成 |
| Lab 02 | 名片小程序       | [lab02](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab02) | ✅ 已完成 |
| Lab 03 | 高校新闻网       | [lab03](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab03) | ✅ 已完成 |
| ...    | 后续实验         | -                                                            | 持续更新 |

---

## Lab 01：第一个微信小程序

实验 1 主要用于熟悉微信小程序的基本结构和开发流程。

主要完成：

- 使用官方 JS 基础模板创建小程序
- 使用 WXML 编写页面结构
- 使用 WXSS 设置页面样式
- 使用 JavaScript 管理页面数据
- 使用 `bindtap` 绑定点击事件
- 使用 `setData()` 更新页面
- 实现按钮点击次数统计
- 不使用模板重新创建一个简单小程序
- 使用 `flag` 实现 `Hello World` 与 `Hello WeChat` 的反复切换

👉 [查看 Lab 01 分支](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab01)

进入分支后可以直接查看实验代码和完整实验报告。

---

## Lab 02：名片小程序

实验 2 完成了一个个人微信小程序名片。

主要完成：

- AI 生成 16:9 个人名片头图
- 使用 WXML 和 WXSS 完成个人名片页面
- 添加个人介绍和关键词词云
- 展示个人学习信息
- 展示 GitHub 项目经历
- 使用 `data-url` 传递项目链接
- 使用 `wx.setClipboardData()` 实现 GitHub 链接复制
- 使用 `wx.showToast()` 提示复制结果
- 使用 `open-type="share"` 和 `onShareAppMessage()` 实现微信分享

👉 [查看 Lab 02 分支](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab02)

进入分支后可以直接查看小程序源码、实验截图和完整实验报告。

---

## Lab 03：高校新闻网

实验 3 完成了一个中国海洋大学校园新闻网小程序，并在基础实验要求上继续增加了一些实际使用功能。

主要完成：

- 使用中国海洋大学近期官方新闻替换 Demo 中的旧新闻数据
- 首页使用轮播图展示重点新闻，并展示新闻列表
- 支持新闻标题、作者和正文内容搜索
- 支持“全部 / 海大要闻 / 综合新闻”分类筛选
- 点击新闻进入详情页，展示完整正文、图片和图注
- 首页、详情页和最近阅读均支持星标收藏，并保持收藏状态同步
- 使用微信小程序 Storage 保存收藏、最近阅读和个人资料
- 收藏与最近阅读支持左滑单条删除、批量删除、全选和一键清空
- 最近阅读记录最后阅读时间，并支持快捷收藏
- 支持微信头像昵称填写、资料修改和本地快捷恢复登录
- 使用 `open-type="share"` 和 `onShareAppMessage()` 实现新闻分享
- 使用 AI 辅助编写 Python 脚本，整理海大官方新闻正文和图片数据

👉 [查看 Lab 03 分支](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab03)

进入分支后可以直接查看最终小程序源码、实验截图和完整实验报告。

---

## 🌿 仓库与分支管理

课程实验仍采用一个实验对应一个分支的方式管理；个人项目 BUGTI Web 当前位于 `main` 分支的 `web/` 目录，并通过 GitHub Actions 部署到 GitHub Pages。

```text
main
│
├── README.md
├── web/
├── .github/
│   └── workflows/
└── ...

lab01
│
├── README.md
├── images/
├── first_test/
├── second_test/
└── .gitignore

lab02
│
├── README.md
├── images/
├── card/
└── .gitignore

lab03
│
├── README.md
├── images/
├── lab03_complete/
└── .gitignore
```
