# <img src="build/icon.png" width="28"> MDCz

![Electron](https://img.shields.io/badge/Electron-39-47848F.svg?style=flat&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?style=flat&logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220.svg?style=flat&logo=pnpm&logoColor=white)

影片元数据刮削与管理工具，基于 Electron 的 Node.js 重写版。

配合 Emby、Jellyfin 等本地影片管理软件，通过番号自动刮削元数据、封面图、缩略图等信息，供本地影片分类整理使用。

## 功能

- 多站点元数据刮削（DMM、FC2 等）
- Emby 演员信息同步
- NFO 文件生成
- 批量处理
- 影片文件自动归类整理

## 快速开始

```bash
pnpm install
pnpm dev
```

### 构建

```bash
pnpm build:win     # Windows (NSIS + Portable)
pnpm build:mac     # macOS (DMG + ZIP)
pnpm build:linux   # Linux (AppImage + deb)
```

## 注意事项

> [!WARNING]
> 本项目仍在活跃开发中，当前刮削核心功能可用，其余设置项尚未经过充分测试。如遇问题欢迎提交 [Issue](https://github.com/ShotHeadman/mdcz/issues) 反馈。

> [!IMPORTANT]
> 不同数据源存在不同的地区访问限制：DMM 仅允许日本 IP 访问，JavDB 则会封锁日本 IP。此外，即使使用对应地区的网络，也可能因 IP 纯净度不足而被封锁。请根据目标数据源选择合适的代理节点。

## 上游项目

本项目基于 [MDCx](https://github.com/sqzw-x/mdcx) 重写，向相关开发者表示敬意。

## 授权许可

本项目在 GPLv3 许可授权下发行。此外，如果使用本项目表明还额外接受以下条款：

- 本项目仅供学习以及技术交流使用
- 请勿在公共社交平台上宣传此项目
- 使用本软件时请遵守当地法律法规
- 法律及使用后果由使用者自己承担
- 禁止将本软件用于任何的商业用途
