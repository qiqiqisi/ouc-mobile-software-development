# BUGTI 宠物素材说明

## 首页监工

- `body/pet_body_default.png`：默认西装身体。
- `body/pet_body_react.png`：点击/抓到玩具时的反应身体。
- `body/pet_body_idle_alt.png`：待机备用姿势。
- `limbs/pet_leg_straight.png`：直腿。
- `limbs/pet_leg_bent.png`：弯腿。
- `extra/pet_sleep_pose.png`：坐地睡觉完整姿势。
- `extra/pet_sleep_mask.png`：睡眠眼罩覆盖层。

## 宠物天地

- `room/pet_room_base.png`：监工小屋背景。
- `room/pet_room_desk.png`：今日计划书桌；前挡板用于遮住桌后宠物下半身。
- `room/pet_room_status_board.png`：动态状态板底图，文字由 WXML 覆盖。
- `room/pet_room_teaser_wand.png`：可拖拽逗宠棒。
- `entry/pet_home_entry_house.png`：首页进入宠物天地的入口小屋。

房间、家具、入口、眼罩素材可以独立裁边和缩放；原有 body / limbs 不应再自动紧裁，因为其姿势锚点依赖固定画布。
