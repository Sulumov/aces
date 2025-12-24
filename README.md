<h1 align="center">Aces</h1>

<p align="center">
  <strong>Ace Stream P2P Video Player</strong>
</p>

<p align="center">
  <a href="#english">English</a> •
  <a href="#русский">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/electron-28.1.0-9feaf9.svg" alt="Electron">
  <img src="https://img.shields.io/badge/react-18.2.0-61dafb.svg" alt="React">
</p>

---

## English

### About

**Aces** is a cross-platform desktop application for watching P2P video streams via the Ace Stream protocol. The app provides a modern, user-friendly interface for playing `acestream://` links and Content IDs with built-in HLS video player.

### ✨ Features

- 🎬 **HLS Video Player** — Smooth playback with quality selection and fullscreen support
- 🔗 **Ace Stream Protocol** — Native support for `acestream://` links and 40-character Content IDs
- 📊 **Real-time Statistics** — View peers, download/upload speed, and buffering status
- 📚 **Watch History** — Automatic history with date grouping
- ⭐ **Bookmarks** — Save favorite streams with drag-and-drop sorting
- 🌍 **Localization** — English and Russian interface
- 🖥️ **Cross-platform** — Works on Windows, Linux, and macOS (via Wine)

### 📋 Requirements

| Platform | Requirements |
|----------|-------------|
| **Windows** | Windows 10/11, Ace Stream Engine |
| **Linux** | Ubuntu 20.04+ / Debian 11+, Ace Stream Engine |
| **macOS** | macOS 11+, Wine, Rosetta 2 (for Apple Silicon) |

#### macOS Setup

For macOS, Wine is required to run Ace Stream Engine:

```bash
# For Apple Silicon (M1/M2/M3/M4) - install Rosetta 2
softwareupdate --install-rosetta --agree-to-license

# Install Wine via Homebrew
brew install --cask --no-quarantine wine-stable
```

### 🚀 Installation

#### Download Release

Download the latest release for your platform from the [Releases](https://github.com/Sulumov/aces/releases) page:

- **Windows**: `Aces-x.x.x-setup.exe`
- **Linux**: `Aces-x.x.x.AppImage` or `.deb`
- **macOS**: `Aces-x.x.x-arm64.dmg`

#### Build from Source

```bash
# Clone the repository
git clone https://github.com/Sulumov/aces.git
cd aces

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build        # All platforms
npm run build:win    # Windows
npm run build:linux  # Linux
npm run build:mac    # macOS
```

### 📦 Adding Ace Stream Engine

The application requires Ace Stream Engine binaries to function:

#### Windows

1. Download Ace Stream from https://acestream.org/
2. Copy contents of `%APPDATA%\ACEStream\engine\` to `engine/win/`

#### Linux

1. Download Ace Stream Engine from https://download.acestream.media/linux/
2. Extract to `engine/linux/`

#### macOS

Uses Windows version of Engine via Wine. Follow Windows instructions and place files in `engine/win/`.

### 📖 Usage

1. Launch the application
2. The app will automatically start Ace Stream Engine
3. Enter an `acestream://` link or 40-character Content ID
4. Click **Play** to start streaming
5. Use the stats panel to monitor connection quality

### 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Electron 28, React 18, TypeScript |
| **Build** | Vite 5, electron-builder |
| **Video** | HLS.js |
| **Networking** | Axios, Ace Stream HTTP API |
| **i18n** | i18next, react-i18next |

---

## Русский

### О приложении

**Aces** — кроссплатформенное десктопное приложение для просмотра P2P видеопотоков через протокол Ace Stream. Приложение предоставляет современный удобный интерфейс для воспроизведения `acestream://` ссылок и Content ID со встроенным HLS-плеером.

### ✨ Возможности

- 🎬 **HLS Видеоплеер** — Плавное воспроизведение с выбором качества и полноэкранным режимом
- 🔗 **Протокол Ace Stream** — Нативная поддержка `acestream://` ссылок и 40-символьных Content ID
- 📊 **Статистика в реальном времени** — Просмотр пиров, скорости загрузки/отдачи и статуса буферизации
- 📚 **История просмотров** — Автоматическое сохранение с группировкой по датам
- ⭐ **Закладки** — Сохранение любимых стримов с drag-and-drop сортировкой
- 🌍 **Локализация** — Английский и русский интерфейс
- 🖥️ **Кроссплатформенность** — Работает на Windows, Linux и macOS (через Wine)

### 📋 Требования

| Платформа | Требования |
|-----------|-----------|
| **Windows** | Windows 10/11, Ace Stream Engine |
| **Linux** | Ubuntu 20.04+ / Debian 11+, Ace Stream Engine |
| **macOS** | macOS 11+, Wine, Rosetta 2 (для Apple Silicon) |

#### Настройка macOS

Для macOS требуется Wine для запуска Ace Stream Engine:

```bash
# Для Apple Silicon (M1/M2/M3/M4) - установка Rosetta 2
softwareupdate --install-rosetta --agree-to-license

# Установка Wine через Homebrew
brew install --cask --no-quarantine wine-stable
```

### 🚀 Установка

#### Скачать релиз

Скачайте последний релиз для вашей платформы со страницы [Releases](https://github.com/Sulumov/aces/releases):

- **Windows**: `Aces-x.x.x-setup.exe`
- **Linux**: `Aces-x.x.x.AppImage` или `.deb`
- **macOS**: `Aces-x.x.x-arm64.dmg`

#### Сборка из исходников

```bash
# Клонируйте репозиторий
git clone https://github.com/Sulumov/aces.git
cd aces

# Установите зависимости
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для вашей платформы
npm run build        # Все платформы
npm run build:win    # Windows
npm run build:linux  # Linux
npm run build:mac    # macOS
```

### 📦 Добавление Ace Stream Engine

Для работы приложения необходимы бинарные файлы Ace Stream Engine:

#### Windows

1. Скачайте Ace Stream с https://acestream.org/
2. Скопируйте содержимое `%APPDATA%\ACEStream\engine\` в `engine/win/`

#### Linux

1. Скачайте Ace Stream Engine с https://download.acestream.media/linux/
2. Распакуйте в `engine/linux/`

#### macOS

Использует Windows-версию Engine через Wine. Следуйте инструкциям для Windows и поместите файлы в `engine/win/`.

### 📖 Использование

1. Запустите приложение
2. Приложение автоматически запустит Ace Stream Engine
3. Введите `acestream://` ссылку или 40-символьный Content ID
4. Нажмите **Play** для начала воспроизведения
5. Используйте панель статистики для мониторинга качества соединения

### 🛠️ Технологии

| Категория | Технологии |
|-----------|-----------|
| **Фреймворк** | Electron 28, React 18, TypeScript |
| **Сборка** | Vite 5, electron-builder |
| **Видео** | HLS.js |
| **Сеть** | Axios, Ace Stream HTTP API |
| **i18n** | i18next, react-i18next |

---

## 👤 Author

**Adam Sulumov** — [sulumov.adam@ya.ru](mailto:sulumov.adam@ya.ru)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Made with ❤️ for the Ace Stream community
</p>
