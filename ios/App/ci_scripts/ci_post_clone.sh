#!/bin/sh
# Xcode Cloud: klonda node_modules ve web paketi (App/public) yok; SPM yerel
# eklenti paketlerini node_modules'tan okuduğu için bağımlılık çözümünden önce
# kurulmalı. cap sync ayrıca Package.swift'i macOS yollarıyla yeniden yazar
# (Windows'ta üretilen ters eğik çizgili sürüm Swift'te derlenmez).
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"

npm ci
npx vite build
npx cap sync ios
