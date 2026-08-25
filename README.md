# OUC Mobile Software Development

中国海洋大学 2026 夏《移动软件开发》课程实验与个人项目仓库。

本仓库用于记录课程实验代码、实验报告以及后续个人项目。  
不同实验使用独立 Git 分支管理，`main` 分支主要用于课程说明和实验导航。

## 📌 实验进度

| 实验 | 内容 | 分支 | 状态 |
| --- | --- | --- | --- |
| Lab 01 | 第一个微信小程序 | [lab01](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab01) | ✅ 已完成 |
| Lab 02 | 名片小程序 | [lab02](https://github.com/qiqiqisi/ouc-mobile-software-development/tree/lab02) | ✅ 已完成 |
| Lab 03 | 待更新 | `lab03` | ⏳ |
| ... | 后续实验 | - | 持续更新 |

## Lab 01：第一个微信小程序

实验1主要用于熟悉微信小程序的基本结构和开发流程。

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

实验2完成了一个个人微信小程序名片。

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

## 🌿 分支管理

本仓库采用一个实验对应一个分支的方式管理。

```text
main
│
├── README.md
└── .gitignore

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
