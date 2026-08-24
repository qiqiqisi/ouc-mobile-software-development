# OUC Mobile Software Development

中国海洋大学 2026 夏《移动软件开发》课程实验与个人项目仓库。

这个仓库用来保存课程实验代码、实验报告和后续个人项目。所有实验统一放在同一个仓库中，按 `lab01`、`lab02`、`lab03` 的方式继续扩展。

## 📌 仓库内容

- 课程实验代码
- Markdown 实验报告
- 实验截图
- 后续个人项目
- 各实验对应的开发分支

## 实验进度

| 实验 | 内容 | 状态 |
| --- | --- | --- |
| Lab 01 | 第一个微信小程序 | ✅ 已完成 |
| Lab 02 | 待更新 | ⏳ |
| Lab 03 | 待更新 | ⏳ |
| ... | 后续实验 | 持续更新 |

## Lab 01

实验1主要完成了两个部分：

### 1. 使用基础模板创建小程序

目录：

```text
lab01/first_test/
```

主要内容：

- 使用官方 JS 基础模板创建项目
- 修改 WXML 页面结构
- 修改 WXSS 页面样式
- 使用 `data` 和 `{{ }}` 显示数据
- 使用 `bindtap` 和 `setData()` 实现点击交互
- 实现按钮点击次数统计

### 2. 不使用模板创建小程序

目录：

```text
lab01/second_test/
```

主要内容：

- 创建项目时选择“不使用模板”
- 编写简单的 WXML、WXSS 和 JavaScript
- 页面初始显示 `Hello World`
- 点击按钮后切换为 `Hello WeChat`
- 使用 `flag = 0 / 1` 记录状态，实现两种文字来回切换

实验报告位于：

```text
lab01/report/
```

## 📁 仓库结构

当前目录结构：

```text
ouc-mobile-software-development/
├── README.md
├── .gitignore
└── lab01/
    ├── first_test/
    ├── second_test/
    └── report/
        ├── 实验1实验报告.md
        └── images/
```

后续实验继续按下面的方式添加：

```text
ouc-mobile-software-development/
├── README.md
├── .gitignore
├── lab01/
├── lab02/
├── lab03/
├── ...
└── project/
```

其中：

- `labXX/`：对应第 XX 次实验
- `report/`：保存实验报告和截图
- `project/`：后续个人项目

## 🌿 分支管理

为了方便维护，每个实验使用单独的分支开发。

目前计划：

| 分支 | 用途 |
| --- | --- |
| `main` | 保存已经完成并确认无误的内容 |
| `lab01` | 实验1 |
| `lab02` | 实验2 |
| `lab03` | 实验3 |
| `project` | 后续个人项目 |

## 如何运行

使用微信开发者工具导入对应的小程序目录即可。

例如实验1：

```text
lab01/first_test
```

或：

```text
lab01/second_test
```

导入后直接编译运行。

实验1主要使用：

- JavaScript
- WXML
- WXSS
- 微信开发者工具

## 实验报告

每个实验的报告统一放在：

```text
labXX/report/
```

推荐结构：

```text
report/
├── 实验X实验报告.md
└── images/
```

Markdown 中的图片使用相对路径，例如：

```markdown
![实验运行结果](images/example.png)
```

这样上传到 GitHub 后，报告中的图片仍然可以正常显示。

## 仓库维护

后续维护时保持以下规则：

1. 所有课程实验放在同一个仓库中。
2. 每次实验使用独立的 `labXX/` 目录。
3. 每次实验使用对应的 `labXX` 分支开发。
4. 完成并检查后再合并到 `main`。
5. 实验代码、Markdown 报告和报告图片一起提交。
6. 不提交本地缓存、临时文件和个人配置文件。
7. 提交前检查代码是否能正常运行、Markdown 图片是否正常显示。

提交信息尽量写清楚修改内容，例如：

```text
feat(lab01): add experiment code
docs(lab01): add experiment report
fix(lab01): fix text toggle logic
```

## 说明

本仓库用于《中国海洋大学 2026 夏〈移动软件开发〉》课程学习记录，后续会随着课程进度继续更新。
