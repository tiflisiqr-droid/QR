import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { supabase, isSupabaseConfigured } from "./src/supabaseClient.js";
import {
  fetchMenuDishes,
  fetchMenuCategories,
  uploadMenuImage,
  insertMenuItem,
  updateMenuDishImageUrl,
  insertFullMenuDish,
  updateFullMenuDish,
  deleteMenuDishById,
  setMenuDishAvailable,
  parsePriceValue,
  priceToCents,
  formatLari,
  fetchSeatingTables,
  insertSeatingTable,
  updateSeatingTable,
  deleteSeatingTable,
  insertMenuCategory,
  updateMenuCategory,
  updateMenuCategorySortOrders,
  updateMenuDishSortOrders,
  deleteMenuCategory,
} from "./src/supabaseMenu.js";

/* ─── GOOGLE FONTS INJECTION ─────────────────────────────────────────────── */
const FontLoader = () => {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);
  return null;
};

/* ─── CSS ANIMATIONS ─────────────────────────────────────────────────────── */
const GlobalStyles = () => {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { margin:0; padding:0; box-sizing:border-box; }
      /* Mobile-first: anchor scroll clears sticky header; pinch zoom still allowed (a11y) */
      html {
        scroll-behavior: auto;
        /* Sticky nav is shorter without in-menu language row */
        scroll-padding-top: min(132px, 34vw);
        -webkit-text-size-adjust: 100%;
        width: 100%;
        overflow-x: clip;
      }
      @media (min-width: 521px) {
        html { scroll-padding-top: 108px; }
      }
      body {
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
        overscroll-behavior-x: none;
        background: var(--obsidian);
      }
      #root {
        min-width: 0;
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
      }
      :root {
        /* Deep teal-tinted base (ფირუზისთან შეხამებული) */
        --obsidian: #050a0a;
        --void: #081012;
        --charcoal: #0f1818;
        --surface: #132220;
        --surface2: #1a2c2a;
        /* Primary accent = ფირუზა (turquoise) — იგივე სემანტიკური სახელები რაც var(--gold) */
        --gold: #3dbfb0;
        --gold-light: #6ee7d8;
        --gold-pale: #d4f7f2;
        /* Warm accent = აგური (terracotta / brick) */
        --amber: #c45844;
        --brick: #c45844;
        --brick-light: #e07a62;
        --brick-pale: #ffd6cc;
        --cream: #eef6f4;
        --muted: #6d8f89;
        --subtle: #2a4542;
        --font-display: 'Cormorant Garamond', Georgia, serif;
        --font-body: 'Montserrat', system-ui, sans-serif;
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: var(--void); }
      ::-webkit-scrollbar-thumb { background: var(--subtle); border-radius: 2px; }
      @keyframes fadeUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity:0; } to { opacity:1; }
      }
      @keyframes shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      @keyframes glow {
        0%,100% { box-shadow: 0 0 20px rgba(61,191,176,0.2); }
        50%      { box-shadow: 0 0 40px rgba(61,191,176,0.38); }
      }
      @keyframes pulse {
        0%,100% { opacity:1; } 50% { opacity:0.4; }
      }
      @keyframes slideIn {
        from { opacity:0; transform:translateX(30px); }
        to   { opacity:1; transform:translateX(0); }
      }
      @keyframes menuSheetUp {
        from { opacity: 0; transform: translateY(22px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes toastIn {
        from { opacity:0; transform:translateX(-50%) translateY(-20px) scale(0.9); }
        to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
      }
      @keyframes scanLine {
        0%   { top: 0; } 100% { top: 100%; }
      }
      @keyframes borderRotate {
        from { transform: rotate(0deg); } to { transform: rotate(360deg); }
      }
      @keyframes menuCardIn {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes menuAddPulse {
        0%   { box-shadow: 0 0 0 0 rgba(61,191,176,0.45); }
        70%  { box-shadow: 0 0 0 12px rgba(61,191,176,0); }
        100% { box-shadow: 0 0 0 0 rgba(61,191,176,0); }
      }
      .menu-page-shell {
        min-height: 100vh;
        min-height: 100dvh;
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
        background: linear-gradient(185deg, #030807 0%, var(--obsidian) 18%, var(--obsidian) 100%);
      }
      /* Space for fixed bottom dock (waiter/bill + optional cart row) + iOS home indicator */
      .menu-main-column {
        padding: 0 max(16px, env(safe-area-inset-right, 0px)) max(168px, calc(132px + env(safe-area-inset-bottom, 0px))) max(16px, env(safe-area-inset-left, 0px));
      }
      .menu-main-column--cart {
        padding-bottom: max(232px, calc(196px + env(safe-area-inset-bottom, 0px)));
      }
      /* Keep section title visible below sticky category nav. */
      .menu-cat-section-anchor {
        scroll-margin-top: 132px;
      }
      .menu-sticky-nav {
        background: rgba(5, 10, 10, 0.78) !important;
        backdrop-filter: blur(22px) saturate(1.2);
        -webkit-backdrop-filter: blur(22px) saturate(1.2);
        border-bottom: 1px solid rgba(201, 169, 98, 0.12) !important;
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      }
      .menu-sticky-nav-inner {
        padding: 10px max(16px, env(safe-area-inset-left, 0px)) 0 max(16px, env(safe-area-inset-right, 0px));
        max-width: 720px;
        margin: 0 auto;
      }
      .menu-search-wrap { position: relative; margin-bottom: 12px; }
      .menu-search-wrap .menu-search-icon {
        position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
        color: rgba(201, 169, 98, 0.55); font-size: 13px; pointer-events: none;
      }
      .menu-search-input {
        width: 100%; max-width: 100%; min-height: 48px; padding: 12px 14px 12px 42px;
        touch-action: manipulation;
        background: rgba(8, 16, 16, 0.65);
        border: 1px solid rgba(201, 169, 98, 0.15);
        border-radius: 999px;
        color: var(--cream); font-size: 14px; font-family: var(--font-body);
        letter-spacing: 0.04em; outline: none; box-sizing: border-box;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.25);
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .menu-search-input::placeholder { color: rgba(109, 143, 137, 0.75); }
      .menu-search-input:focus {
        border-color: rgba(61, 191, 176, 0.45);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(61, 191, 176, 0.12), 0 12px 36px rgba(0,0,0,0.3);
      }
      .menu-cat-scroll {
        display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none;
        padding: 4px 2px 16px; -webkit-overflow-scrolling: touch;
        overscroll-behavior-x: contain;
        touch-action: pan-x;
      }
      .menu-cat-scroll::-webkit-scrollbar { display: none; }
      .menu-cat-tab {
        flex-shrink: 0;
        min-height: 48px;
        min-width: 44px;
        padding: 12px 20px;
        border-radius: 999px;
        border: 1px solid rgba(61, 191, 176, 0.14);
        background: rgba(6, 12, 12, 0.5);
        color: rgba(238, 246, 244, 0.65);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        white-space: nowrap;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.2s ease, border-color 0.25s ease, box-shadow 0.25s ease, color 0.2s ease, background 0.25s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      @media (hover: hover) {
      .menu-cat-tab:hover {
        border-color: rgba(201, 169, 98, 0.35);
        color: var(--cream);
        transform: translateY(-1px);
      }
      }
      .menu-cat-tab:active {
        transform: scale(0.98);
      }
      .menu-cat-tab--active {
        border-color: rgba(201, 169, 98, 0.55) !important;
        background: linear-gradient(135deg, rgba(201, 169, 98, 0.22), rgba(61, 191, 176, 0.12)) !important;
        color: #f4f1ea !important;
        box-shadow: 0 0 28px rgba(61, 191, 176, 0.12), 0 8px 24px rgba(0,0,0,0.35);
      }
      .menu-section-head {
        display: flex; align-items: center; gap: 14px; margin-bottom: 20px;
      }
      .menu-section-icon {
        width: 40px; height: 40px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; color: var(--gold);
        background: rgba(61, 191, 176, 0.08);
        border: 1px solid rgba(201, 169, 98, 0.2);
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      }
      .menu-section-title {
        font-family: var(--font-display);
        font-size: clamp(1.45rem, 4.5vw, 1.85rem);
        font-weight: 300;
        font-style: italic;
        color: var(--cream);
        letter-spacing: 0.06em;
        margin: 0;
        line-height: 1.15;
      }
      .menu-section-line {
        flex: 1; height: 1px;
        background: linear-gradient(90deg, rgba(201, 169, 98, 0.35), transparent);
        min-width: 24px;
      }
      .menu-dish-list { display: flex; flex-direction: column; gap: 16px; }
      @media (max-width: 520px) {
        .menu-dish-list { gap: 12px; }
      }
      .dish-card.menu-dish-card {
        position: relative;
        isolation: isolate;
        animation: menuCardIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        border-radius: 20px;
        overflow: hidden;
        background: linear-gradient(152deg, rgba(18, 32, 30, 0.88), rgba(6, 11, 11, 0.82));
        border: 1px solid rgba(255, 215, 0, 0.14);
        backdrop-filter: blur(12px) saturate(1.08);
        -webkit-backdrop-filter: blur(12px) saturate(1.08);
        box-shadow:
          0 12px 44px rgba(0, 0, 0, 0.42),
          0 0 0 1px rgba(255, 215, 0, 0.06),
          0 0 24px rgba(255, 215, 0, 0.06),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease;
      }
      .dish-card.menu-dish-card::before {
        content: "";
        position: absolute;
        top: 0;
        left: -100%;
        width: 200%;
        height: 100%;
        background: linear-gradient(
          118deg,
          transparent 0%,
          transparent 40%,
          rgba(255, 215, 0, 0.1) 47%,
          rgba(255, 236, 210, 0.22) 50%,
          rgba(255, 215, 0, 0.1) 53%,
          transparent 60%,
          transparent 100%
        );
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        mix-blend-mode: soft-light;
        transition: left 1.55s ease-in-out, opacity 0.35s ease;
      }
      .dish-card.menu-dish-card::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        z-index: 1;
        opacity: 0.18;
        background-image:
          radial-gradient(circle at 10% 15%, rgba(255, 230, 190, 0.14) 0, transparent 0.5%),
          radial-gradient(circle at 24% 72%, rgba(255, 215, 0, 0.1) 0, transparent 0.45%),
          radial-gradient(circle at 86% 22%, rgba(255, 240, 210, 0.12) 0, transparent 0.48%),
          radial-gradient(circle at 70% 86%, rgba(201, 169, 98, 0.1) 0, transparent 0.42%),
          radial-gradient(circle at 52% 48%, rgba(255, 220, 160, 0.06) 0, transparent 0.35%);
        transition: opacity 0.35s ease;
      }
      .dish-card.menu-dish-card > * {
        position: relative;
        z-index: 2;
      }
      @media (hover: hover) {
      .dish-card.menu-dish-card:hover {
        transform: translateY(-3px) scale(1.02);
        border-color: rgba(255, 215, 0, 0.28);
        background: linear-gradient(152deg, rgba(22, 38, 36, 0.9), rgba(8, 14, 14, 0.86));
        box-shadow:
          0 24px 56px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 215, 0, 0.12),
          0 0 36px rgba(255, 215, 0, 0.14),
          0 0 52px rgba(61, 191, 176, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      .dish-card.menu-dish-card:hover::before {
        left: 100%;
        opacity: 1;
      }
      .dish-card.menu-dish-card:hover::after {
        opacity: 0.28;
      }
      .dish-card.menu-dish-card:hover .dish-card-media .dish-img { transform: scale(1.07); }
      }
      .dish-card.menu-dish-card.menu-dish-card--expanded {
        border-color: rgba(255, 215, 0, 0.22);
        background: linear-gradient(152deg, rgba(22, 42, 40, 0.92), rgba(8, 14, 14, 0.88));
        box-shadow:
          0 14px 48px rgba(0, 0, 0, 0.45),
          0 0 0 1px rgba(255, 215, 0, 0.1),
          0 0 28px rgba(255, 215, 0, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.07);
      }
      @media (hover: none) {
        .dish-card.menu-dish-card:active { transform: scale(0.992); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dish-card.menu-dish-card { animation: fadeIn 0.4s ease both; transition: none; }
        .dish-card.menu-dish-card:hover { transform: none; }
        .dish-card.menu-dish-card::before { transition: none; opacity: 0 !important; left: -100% !important; }
        .dish-card.menu-dish-card:hover::before { left: -100%; opacity: 0; }
      }
      .dish-card-inner { display: flex; align-items: stretch; gap: 0; }
      .dish-card.menu-dish-card .dish-card-media {
        flex-shrink: 0;
        width: 168px;
        min-height: 140px;
        position: relative;
        overflow: hidden;
        align-self: stretch;
        background: linear-gradient(165deg, rgba(36, 58, 54, 0.5), rgba(5, 10, 10, 0.95));
        border-right: 1px solid rgba(201, 169, 98, 0.08);
      }
      .dish-card.menu-dish-card .dish-card-media .dish-img {
        width: 100%;
        height: 100%;
        min-height: 140px;
        object-fit: cover;
        object-position: center;
        display: block;
        transition: transform 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
      .dish-card.menu-dish-card .dish-card-media .dish-img-placeholder {
        width: 100%;
        min-height: 140px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(109,143,137,0.5);
        font-size: 10px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        font-family: var(--font-body);
      }
      @media (max-width: 520px) {
        .dish-card-inner { flex-direction: column; }
        .dish-card.menu-dish-card .dish-card-media {
          width: 100% !important;
          aspect-ratio: 4 / 3;
          min-height: min(42vw, 180px) !important;
          max-height: none;
          border-right: none;
          border-bottom: 1px solid rgba(201, 169, 98, 0.1);
        }
        .dish-card.menu-dish-card .dish-card-media .dish-img {
          width: 100%;
          height: 100%;
          min-height: 0 !important;
          max-height: none;
          object-fit: cover;
          object-position: center;
        }
        .dish-card.menu-dish-card .dish-card-media .dish-img-placeholder {
          min-height: 0 !important;
          height: 100%;
        }
        .menu-dish-card-body { padding: 12px 14px !important; }
        .menu-dish-price-row {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
        }
        .menu-dish-price-row .menu-dish-price-controls {
          justify-content: space-between;
          width: 100%;
        }
      }
      @media (max-width: 380px) {
        .menu-add-btn {
          padding: 10px 16px;
          font-size: 9px;
          letter-spacing: 0.16em;
          min-height: 48px;
        }
      }
      .menu-feature-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 11px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-family: var(--font-body);
        color: rgba(244, 241, 234, 0.95);
        border: 1px solid rgba(201, 169, 98, 0.45);
        background: linear-gradient(135deg, rgba(201, 169, 98, 0.2), rgba(61, 191, 176, 0.08));
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      }
      .menu-dish-name {
        font-family: var(--font-display);
        font-size: clamp(1.15rem, 3.8vw, 1.35rem);
        font-weight: 400;
        color: var(--cream);
        letter-spacing: 0.02em;
        line-height: 1.22;
      }
      .menu-dish-blurb {
        margin-top: 8px;
        font-size: 11px;
        color: rgba(109, 143, 137, 0.95);
        line-height: 1.55;
        font-weight: 400;
        letter-spacing: 0.04em;
      }
      @media (max-width: 430px) {
        .menu-dish-name { margin-top: 2px; }
        .menu-dish-blurb { margin-top: 10px; font-size: 12px; line-height: 1.58; }
        .menu-dish-price { margin-top: 2px; }
        .menu-section-head { gap: 10px; margin-bottom: 18px; }
        .menu-dish-expanded { padding: 14px 16px; }
      }
      .menu-dish-price {
        font-family: var(--font-display);
        font-size: clamp(1.25rem, 3.5vw, 1.45rem);
        font-weight: 300;
        color: #c9a962;
        letter-spacing: 0.04em;
      }
      .menu-cart-step {
        width: 44px; height: 44px; min-width: 44px; min-height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(61, 191, 176, 0.3);
        background: rgba(8, 14, 14, 0.75);
        color: var(--cream);
        font-size: 18px;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        -webkit-tap-highlight-color: transparent;
      }
      @media (hover: hover) {
      .menu-cart-step:hover {
        transform: scale(1.06);
        border-color: rgba(201, 169, 98, 0.45);
        box-shadow: 0 0 20px rgba(61, 191, 176, 0.15);
      }
      }
      .menu-cart-step:active {
        transform: scale(0.96);
      }
      .menu-cart-step--plus {
        border-color: rgba(61, 191, 176, 0.45);
        background: rgba(61, 191, 176, 0.12);
        color: var(--gold);
      }
      .menu-add-btn {
        position: relative;
        min-height: 48px;
        padding: 12px 22px;
        border-radius: 999px;
        border: 1px solid rgba(201, 169, 98, 0.45);
        background: linear-gradient(135deg, rgba(201, 169, 98, 0.18), rgba(61, 191, 176, 0.08));
        color: #f4f1ea;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: var(--font-body);
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.25s ease, filter 0.2s ease;
        -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
      }
      .menu-add-btn::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: 0 0 0 0 rgba(61, 191, 176, 0.35);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      @media (hover: hover) {
      .menu-add-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        filter: brightness(1.06);
        box-shadow: 0 10px 32px rgba(0,0,0,0.4), 0 0 36px rgba(61, 191, 176, 0.15), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      }
      .menu-add-btn:active:not(:disabled) {
        transform: translateY(0);
        filter: brightness(0.98);
      }
      .menu-add-btn:disabled {
        opacity: 0.38;
        cursor: not-allowed;
        filter: grayscale(0.3);
      }
      .menu-add-btn.menu-add-btn--pulse { animation: menuAddPulse 0.55s ease-out 1; }
      .menu-cart-step.menu-cart-step--pulse { animation: menuAddPulse 0.55s ease-out 1; }
      .menu-expand-chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 44px;
        min-height: 44px;
        margin: -8px -4px -8px 0;
        font-size: 11px;
        color: rgba(201, 169, 98, 0.55);
        transition: transform 0.35s ease;
        flex-shrink: 0;
      }
      .menu-dish-expanded {
        padding: 16px 18px;
        border-top: 1px solid rgba(61, 191, 176, 0.12);
        background: linear-gradient(180deg, rgba(61, 191, 176, 0.06), rgba(5, 10, 10, 0.5));
        animation: fadeIn 0.35s ease;
      }
      .menu-bottom-dock {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10100;
        width: 100%;
        max-width: none;
        margin: 0;
        background: linear-gradient(0deg, rgba(2, 6, 6, 0.99) 0%, rgba(4, 10, 10, 0.96) 50%, rgba(4, 10, 10, 0.82) 100%);
        padding-top: 10px;
        padding-left: max(12px, env(safe-area-inset-left, 0px));
        padding-right: max(12px, env(safe-area-inset-right, 0px));
        padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
        box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45);
      }
      .menu-bottom-dock-inner {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
      .menu-cart-bar {
        background: transparent;
        padding: 0 4px 0;
      }
      .menu-cart-open-btn {
        width: 100%;
        min-height: 56px;
        margin-bottom: 10px;
        touch-action: manipulation;
        padding: 14px 18px;
        border: 1px solid rgba(201, 169, 98, 0.4);
        border-radius: 999px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-family: var(--font-body);
        background: linear-gradient(135deg, rgba(201, 169, 98, 0.22), rgba(61, 191, 176, 0.12));
        color: #f4f1ea;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 40px rgba(61, 191, 176, 0.12), inset 0 1px 0 rgba(255,255,255,0.08);
        transition: transform 0.2s ease, box-shadow 0.25s ease;
        -webkit-tap-highlight-color: transparent;
      }
      @media (hover: hover) {
      .menu-cart-open-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 44px rgba(0,0,0,0.5), 0 0 48px rgba(61, 191, 176, 0.18); }
      }
      .menu-cart-open-btn:active { transform: translateY(0); }
      .menu-service-btn {
        min-height: 48px;
        touch-action: manipulation;
        padding: 14px 12px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .menu-service-btn--waiter {
        border: 1px solid rgba(61, 191, 176, 0.45);
        background: linear-gradient(135deg, rgba(61, 191, 176, 0.18), rgba(8, 18, 18, 0.9));
        color: var(--gold-pale);
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      }
      .menu-service-btn--bill {
        border: 1px solid rgba(196, 88, 68, 0.45);
        background: linear-gradient(135deg, rgba(196, 88, 68, 0.16), rgba(8, 12, 12, 0.92));
        color: var(--brick-pale);
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      }
      @media (hover: hover) {
      .menu-service-btn:hover { transform: translateY(-2px); }
      }
      .menu-service-btn:active { transform: translateY(0); }
      .menu-hero-strip {
        position: relative;
        height: min(200px, 28vh);
        overflow: hidden;
        overflow-anchor: none;
        border-bottom: 1px solid rgba(201, 169, 98, 0.1);
      }
      .menu-hero-strip::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(4,8,8,0.2) 0%, var(--obsidian) 100%),
          radial-gradient(ellipse at 80% 10%, rgba(201, 169, 98, 0.12), transparent 50%),
          radial-gradient(ellipse at 40% 0%, rgba(61, 191, 176, 0.12), transparent 55%);
        z-index: 1;
        pointer-events: none;
      }
      .menu-cart-sheet {
        background: linear-gradient(180deg, rgba(18, 32, 30, 0.98), rgba(8, 14, 14, 0.99)) !important;
        border-top: 1px solid rgba(201, 169, 98, 0.25) !important;
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: 0 -28px 80px rgba(0,0,0,0.65) !important;
        padding-bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
      }
      .menu-cart-sheet-close {
        min-width: 44px;
        min-height: 44px;
        padding: 8px 14px;
        border: 1px solid rgba(61,191,176,0.25);
        background: transparent;
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 2px;
        text-transform: uppercase;
        cursor: pointer;
        font-family: var(--font-body);
        border-radius: 2px;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .menu-cart-sheet-qty-btn {
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        border-radius: 2px;
        border: 1px solid rgba(61,191,176,0.28);
        background: rgba(255,255,255,0.04);
        color: var(--cream);
        font-size: 18px;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .menu-cart-sheet-qty-btn--plus {
        border-color: rgba(61,191,176,0.4);
        background: rgba(61,191,176,0.12);
        color: var(--gold);
      }
      .menu-cart-sheet-qty-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      @keyframes socialGoldShimmer {
        0%   { transform: translate3d(-135%, 0, 0) skewX(-13deg); opacity: 0; }
        12%  { opacity: 1; }
        88%  { opacity: 1; }
        100% { transform: translate3d(235%, 0, 0) skewX(-13deg); opacity: 0; }
      }
      .social-top-strip {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 12px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 4px 2px 6px;
        margin-bottom: 10px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-x: contain;
        touch-action: pan-x;
      }
      .social-top-strip::-webkit-scrollbar { display: none; }
      .social-top-link {
        --social-accent: #3dbfb0;
        position: relative;
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid rgba(201, 169, 98, 0.32);
        text-decoration: none;
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(244, 247, 246, 0.92);
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.09) 0%, transparent 42%, rgba(61, 191, 176, 0.06) 100%),
          linear-gradient(155deg, rgba(12, 18, 18, 0.62), rgba(4, 8, 10, 0.45));
        backdrop-filter: blur(18px) saturate(1.15);
        -webkit-backdrop-filter: blur(18px) saturate(1.15);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.07),
          0 6px 28px rgba(0, 0, 0, 0.35);
        transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease, color 0.35s ease;
        -webkit-tap-highlight-color: transparent;
        box-sizing: border-box;
        overflow: hidden;
        touch-action: manipulation;
      }
      .social-top-link::before {
        content: "";
        position: absolute;
        inset: 0;
        left: 0;
        width: 48%;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(
          118deg,
          transparent 0%,
          transparent 34%,
          rgba(201, 169, 98, 0.1) 45%,
          rgba(255, 232, 190, 0.22) 50%,
          rgba(201, 169, 98, 0.1) 55%,
          transparent 66%,
          transparent 100%
        );
        transform: translate3d(-125%, 0, 0) skewX(-12deg);
        opacity: 0;
        mix-blend-mode: soft-light;
      }
      @media (hover: hover) {
      .social-top-link:hover {
        transform: scale(1.04);
        border-color: color-mix(in srgb, var(--social-accent) 50%, rgba(201, 169, 98, 0.55));
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, transparent 40%, rgba(61, 191, 176, 0.07) 100%),
          linear-gradient(155deg, rgba(18, 32, 30, 0.72), rgba(6, 12, 12, 0.55));
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.11),
          0 0 0 1px color-mix(in srgb, var(--social-accent) 22%, transparent),
          0 0 28px rgba(201, 169, 98, 0.14),
          0 0 40px color-mix(in srgb, var(--social-accent) 26%, transparent),
          0 14px 40px rgba(0, 0, 0, 0.42);
      }
      .social-top-link:hover::before {
        animation: socialGoldShimmer 1.5s ease-in-out 1;
      }
      }
      .social-top-link:active {
        transform: scale(1.02);
      }
      .social-top-link--icon {
        width: 48px;
        min-width: 48px;
        max-width: 48px;
        height: 48px;
        padding: 0;
      }
      .social-top-link--text {
        padding: 0 18px;
        min-width: 88px;
        color: rgba(248, 250, 249, 0.96);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      }
      @media (hover: hover) {
      .social-top-link--text:hover {
        color: #fff;
        text-shadow: 0 0 18px color-mix(in srgb, var(--social-accent) 35%, transparent), 0 1px 3px rgba(0, 0, 0, 0.4);
      }
      }
      .social-top-link__icon-mask {
        position: relative;
        z-index: 2;
        display: block;
        width: 22px;
        height: 22px;
        background: linear-gradient(145deg, var(--social-accent), color-mix(in srgb, var(--social-accent) 72%, #f4f7f6));
        -webkit-mask-image: var(--social-icon-url);
        mask-image: var(--social-icon-url);
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        opacity: 0.88;
        transition: opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease;
      }
      @media (hover: hover) {
      .social-top-link:hover .social-top-link__icon-mask {
        opacity: 0.96;
        transform: scale(1.06);
        filter: saturate(1.12) brightness(1.05);
      }
      }
      .social-top-link__icon-mask--gradient {
        background: var(--social-icon-gradient);
      }
      @media (max-width: 480px) {
        .social-top-strip { gap: 10px; padding-left: 0; padding-right: 0; }
        .social-top-link { min-height: 50px; border-radius: 16px; }
        .social-top-link--icon {
          width: 50px;
          min-width: 50px;
          max-width: 50px;
          height: 50px;
        }
        .social-top-link__icon-mask { width: 23px; height: 23px; }
        .social-top-link--text { min-width: 92px; padding: 0 16px; font-size: 9px; }
      }
      @media (prefers-reduced-motion: reduce) {
        @media (hover: hover) {
        .social-top-link:hover::before { animation: none; opacity: 0; }
        .social-top-link:hover { transform: none; }
        }
      }
      @media (hover: hover) {
      .nav-btn:hover { letter-spacing: 2.5px !important; }
      .action-btn:hover { transform: translateY(-2px); }
      .admin-nav-item:hover { background: rgba(61,191,176,0.1) !important; }
      }
      .action-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      .action-btn:active { transform: translateY(0); }
      .gold-line::after {
        content: ''; display: block; width: 40px; height: 1px;
        background: linear-gradient(90deg, var(--gold), transparent);
        margin-top: 8px;
      }
      .noise {
        position: fixed; inset: 0; pointer-events: none; z-index: 999;
        opacity: 0.025;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      }
      .tag { transition: all 0.2s; }
      @media (hover: hover) {
      .tag:hover { transform: translateY(-1px); }
      }

      /* ─── Welcome hero (luxury first screen) ─────────────────────────── */
      .welcome-hero-root {
        --welcome-champagne: #c9a962;
        --welcome-champagne-dim: rgba(201, 169, 98, 0.55);
        --welcome-ink: #040608;
        position: relative;
        min-height: 100vh;
        min-height: 100dvh;
        width: 100%;
        max-width: 100vw;
        overflow: hidden;
        overflow-x: clip;
        background: var(--welcome-ink);
        color: var(--cream);
        font-family: var(--font-body);
        isolation: isolate;
      }
      .welcome-hero-media-wrap {
        position: absolute;
        inset: -6%;
        z-index: 0;
        pointer-events: none;
      }
      .welcome-hero-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 42%;
        transform: scale(1.08) translate3d(0, 0, 0);
        will-change: transform;
      }
      @media (hover: none), (pointer: coarse) {
        .welcome-hero-root:not(.welcome-hero--parallax) .welcome-hero-img {
          animation: welcomeBgDrift 28s ease-in-out infinite alternate;
        }
      }
      @keyframes welcomeBgDrift {
        0%   { transform: scale(1.1) translate3d(-1.2%, -0.8%, 0); }
        100% { transform: scale(1.12) translate3d(1.2%, 0.8%, 0); }
      }
      .welcome-hero-dark {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background:
          linear-gradient(180deg, rgba(2,4,6,0.72) 0%, rgba(4,8,10,0.45) 38%, rgba(4,8,10,0.82) 100%),
          radial-gradient(ellipse 90% 60% at 50% 0%, rgba(61,191,176,0.12), transparent 55%);
      }
      .welcome-hero-vignette {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        box-shadow: inset 0 0 120px rgba(0,0,0,0.65);
      }
      .welcome-hero-inner {
        position: relative;
        z-index: 3;
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: max(28px, env(safe-area-inset-top, 0px)) max(22px, env(safe-area-inset-right, 0px)) max(28px, env(safe-area-inset-bottom, 0px)) max(22px, env(safe-area-inset-left, 0px));
        width: 100%;
        max-width: 520px;
        margin: 0 auto;
        text-align: center;
      }
      .welcome-hero-social {
        margin-top: clamp(18px, 4.5vw, 26px);
        width: 100%;
        max-width: 100%;
      }
      .welcome-hero-social .social-top-strip {
        margin-bottom: 0;
        justify-content: center;
      }
      @media (max-height: 700px) {
        .welcome-hero-inner {
          justify-content: flex-start;
          padding-top: max(20px, env(safe-area-inset-top, 0px));
        }
        .welcome-hero-eyebrow { margin-bottom: 10px; letter-spacing: 0.42em; }
        .welcome-hero-sub { margin-top: 12px; }
        .welcome-hero-ka { margin-top: 6px; font-size: 14px; }
        .welcome-hero-table { margin-top: 14px; }
        .welcome-hero-divider { margin: 16px 0 12px; }
        .welcome-hero-hint { margin-top: 14px; }
      }
      .welcome-hero-eyebrow {
        font-size: clamp(9px, 2.4vw, 11px);
        letter-spacing: 0.55em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--welcome-champagne);
        margin-bottom: clamp(14px, 4vw, 22px);
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
      }
      .welcome-hero-title {
        font-family: var(--font-display);
        font-weight: 300;
        font-style: italic;
        font-size: clamp(2.65rem, 10vw, 4.25rem);
        line-height: 1.02;
        letter-spacing: 0.04em;
        color: #f4f7f6;
        text-shadow: 0 4px 48px rgba(0,0,0,0.55);
        margin: 0;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.28s forwards;
      }
      .welcome-hero-title span {
        display: block;
        font-style: normal;
        font-weight: 400;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        font-size: clamp(0.72rem, 2.8vw, 0.85rem);
        margin-top: 0.65em;
        color: var(--welcome-champagne-dim);
      }
      .welcome-hero-sub {
        margin-top: clamp(18px, 4.5vw, 26px);
        font-size: clamp(14px, 3.6vw, 16px);
        font-weight: 400;
        line-height: 1.55;
        letter-spacing: 0.06em;
        color: rgba(238,246,244,0.88);
        max-width: 34em;
        margin-left: auto;
        margin-right: auto;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.4s forwards;
      }
      .welcome-hero-ka {
        margin-top: 10px;
        font-family: var(--font-display);
        font-size: clamp(16px, 4vw, 20px);
        font-weight: 300;
        font-style: italic;
        color: rgba(212,247,242,0.75);
        letter-spacing: 0.02em;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.48s forwards;
      }
      .welcome-hero-table {
        margin-top: clamp(22px, 5vw, 30px);
        width: 100%;
        max-width: 320px;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.55s forwards;
      }
      .welcome-hero-table label {
        display: block;
        font-size: 9px;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: var(--welcome-champagne-dim);
        margin-bottom: 10px;
        font-weight: 600;
      }
      .welcome-hero-table select {
        width: 100%;
        max-width: 100%;
        appearance: none;
        -webkit-appearance: none;
        touch-action: manipulation;
        padding: 14px 40px 14px 18px;
        border-radius: 999px;
        border: 1px solid rgba(201, 169, 98, 0.35);
        background: rgba(4,8,10,0.65);
        color: var(--cream);
        font-family: var(--font-body);
        font-size: 13px;
        letter-spacing: 0.12em;
        cursor: pointer;
        box-shadow:
          0 0 0 1px rgba(0,0,0,0.4),
          0 12px 40px rgba(0,0,0,0.35),
          inset 0 1px 0 rgba(255,255,255,0.06);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        background-image: linear-gradient(180deg, rgba(255,255,255,0.06), transparent);
        transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease;
      }
      @media (hover: hover) {
      .welcome-hero-table select:hover {
        border-color: rgba(61, 191, 176, 0.45);
        box-shadow:
          0 0 0 1px rgba(61, 191, 176, 0.15),
          0 16px 48px rgba(0,0,0,0.4),
          0 0 28px rgba(61, 191, 176, 0.12);
      }
      }
      .welcome-hero-table-wrap {
        position: relative;
      }
      .welcome-hero-table-wrap::after {
        content: "";
        position: absolute;
        right: 18px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid var(--welcome-champagne-dim);
        pointer-events: none;
      }
      .welcome-hero-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        margin: clamp(26px, 6vw, 36px) 0 clamp(18px, 4vw, 22px);
        width: 100%;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.62s forwards;
      }
      .welcome-hero-divider i {
        flex: 1;
        height: 1px;
        max-width: 72px;
        background: linear-gradient(90deg, transparent, var(--welcome-champagne-dim));
      }
      .welcome-hero-divider i:last-child {
        background: linear-gradient(90deg, var(--welcome-champagne-dim), transparent);
      }
      .welcome-hero-divider span {
        font-size: 9px;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: rgba(109, 143, 137, 0.95);
        white-space: nowrap;
      }
      .welcome-hero-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.72s forwards;
      }
      .welcome-btn-primary {
        position: relative;
        width: 100%;
        touch-action: manipulation;
        padding: 17px 22px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        font-family: var(--font-display);
        font-size: clamp(17px, 4.2vw, 20px);
        font-weight: 500;
        font-style: italic;
        letter-spacing: 0.06em;
        color: #0a1010;
        background: linear-gradient(135deg, #e8d5a8 0%, var(--welcome-champagne) 45%, #a88442 100%);
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.25) inset,
          0 4px 24px rgba(201, 169, 98, 0.35),
          0 18px 48px rgba(0,0,0,0.45);
        transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, filter 0.2s ease;
        -webkit-tap-highlight-color: transparent;
        overflow: hidden;
      }
      .welcome-btn-primary::before {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(120deg, rgba(255,255,255,0.65), transparent 40%, rgba(61,191,176,0.5), transparent 70%);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0.85;
        pointer-events: none;
        animation: welcomeBorderShimmer 5s linear infinite;
      }
      @keyframes welcomeBorderShimmer {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @media (hover: hover) {
      .welcome-btn-primary:hover {
        transform: translateY(-2px);
        filter: brightness(1.05);
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.3) inset,
          0 6px 32px rgba(201, 169, 98, 0.45),
          0 0 40px rgba(61, 191, 176, 0.22),
          0 22px 56px rgba(0,0,0,0.5);
      }
      }
      .welcome-btn-primary:active { transform: translateY(0); }
      .welcome-btn-primary small {
        display: block;
        margin-top: 4px;
        font-family: var(--font-body);
        font-size: 10px;
        font-style: normal;
        font-weight: 600;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .welcome-btn-ghost {
        width: 100%;
        touch-action: manipulation;
        padding: 15px 20px;
        border-radius: 999px;
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(244,247,246,0.92);
        background: rgba(4,8,10,0.35);
        border: 1px solid rgba(61, 191, 176, 0.22);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
        transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease, color 0.2s ease;
        -webkit-tap-highlight-color: transparent;
      }
      @media (hover: hover) {
      .welcome-btn-ghost:hover {
        border-color: rgba(61, 191, 176, 0.5);
        box-shadow:
          0 0 24px rgba(61, 191, 176, 0.15),
          0 10px 36px rgba(0,0,0,0.3);
        transform: translateY(-1px);
        color: var(--gold-light);
      }
      }
      .welcome-hero-hint {
        margin-top: clamp(20px, 4vw, 26px);
        font-size: 10px;
        letter-spacing: 0.2em;
        color: rgba(109, 143, 137, 0.75);
        line-height: 1.6;
        opacity: 0;
        animation: welcomeFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.85s forwards;
      }
      @keyframes welcomeFadeUp {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .welcome-hero-img { animation: none !important; }
        .welcome-btn-primary::before { animation: none; }
        .welcome-hero-eyebrow, .welcome-hero-title, .welcome-hero-sub, .welcome-hero-ka,
        .welcome-hero-table, .welcome-hero-divider, .welcome-hero-actions, .welcome-hero-hint {
          animation: welcomeFadeIn 0.6s ease forwards !important;
          opacity: 1;
        }
        @keyframes welcomeFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      }
      .admin-panel-layout {
        min-height: 100vh;
        width: 100%;
        max-width: 100vw;
        overflow-x: clip;
        background: var(--void);
        display: flex;
        font-family: var(--font-body);
      }
      @media (max-width: 900px) {
        .admin-panel-layout { flex-direction: column; }
        .admin-panel-sidebar {
          width: 100% !important;
          max-width: 100% !important;
          border-right: none !important;
          border-bottom: 1px solid rgba(61, 191, 176, 0.1) !important;
        }
        .admin-panel-sidebar nav {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          overflow-y: hidden;
          gap: 4px;
          padding: 8px 10px 12px;
          overscroll-behavior-x: contain;
        }
        .admin-panel-sidebar nav button { flex: 0 0 auto; white-space: nowrap; }
        .admin-panel-main { min-width: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

/* ─── DATA ───────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 1, name: { en: "Khinkali", ka: "ხინკალი", ru: "Хинкали" }, icon: "◈", order: 1 },
  { id: 2, name: { en: "Khachapuri", ka: "ხაჭაპური", ru: "Хачапури" }, icon: "◇", order: 2 },
  { id: 3, name: { en: "Grill & Josper", ka: "შამფური და ჯოსპერი", ru: "Мангал и джоспер" }, icon: "◉", order: 3 },
  { id: 4, name: { en: "Salads", ka: "სალათები", ru: "Салаты" }, icon: "◌", order: 4 },
  { id: 5, name: { en: "Desserts", ka: "დესერტები", ru: "Десерты" }, icon: "◎", order: 5 },
  { id: 6, name: { en: "Cellar", ka: "სასმელები", ru: "Погреб" }, icon: "◊", order: 6 },
];

const DISHES = [
  { id:1, categoryId:1, name:{en:"Lamb Khinkali",ka:"კრავის ხინკალი",ru:"Хинкали с Ягнёнком"}, description:{en:"Hand-pleated parcels of slow-spiced mountain lamb in golden broth",ka:"ხელნაკეთი ხინკალი მთის კრავით",ru:"Лепные хинкали из горного ягнёнка"}, price:18, image:"https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=90", ingredients:["Mountain Lamb","Wild Herbs","Black Pepper","Onion","Saffron Broth"], badges:["Signature","Popular"], available:true, featured:true },
  { id:2, categoryId:1, name:{en:"Truffle & Porcini",ka:"ტრიუფელის ხინკალი",ru:"Трюфель и Белый Гриб"}, description:{en:"Black truffle infused wild mushroom filling, aged parmesan crust",ka:"შავი ტრიუფელი, ველური სოკო",ru:"Чёрный трюфель с белыми грибами"}, price:32, image:"https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=90", ingredients:["Black Truffle","Porcini","Aged Parmesan","Thyme"], badges:["Chef's Table"], available:true, featured:true },
  { id:3, categoryId:2, name:{en:"Adjarian Royal",ka:"აჭარული",ru:"Аджарская"}, description:{en:"Sulguni three-cheese blend, farm egg yolk, brown butter, sea salt",ka:"სამი ყველი, სოფლის კვერცხი",ru:"Три сыра, желток, масло"}, price:22, image:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=90", ingredients:["Sulguni","Gouda","Parmesan","Farm Egg","Brown Butter","Fleur de Sel"], badges:["Signature","Popular"], available:true, featured:true },
  { id:4, categoryId:2, name:{en:"Imeruli Khachapuri",ka:"იმერული ხაჭაპური",ru:"Имерская Хачапури"}, description:{en:"Classic round bread, house-churned butter, fresh Imeruli cheese",ka:"იმერული ყველი, კარაქი",ru:"Классическая с имерским сыром"}, price:16, image:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=90", ingredients:["Imeruli Cheese","House Butter","Eggs"], badges:[], available:true, featured:false },
  { id:5, categoryId:3, name:{en:"Wagyu Mtsvadi",ka:"ვაგიუ მწვადი",ru:"Вагю Мцвади"}, description:{en:"A5 Wagyu skewer, pomegranate reduction, smoked salt, tkemali jus",ka:"A5 ვაგიუ, ბროწეული",ru:"А5 Вагю с гранатовым жю"}, price:68, image:"https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=90", ingredients:["A5 Wagyu","Pomegranate","Smoked Salt","Tkemali","Rosemary"], badges:["Chef's Table","New"], available:true, featured:true },
  { id:6, categoryId:3, name:{en:"Lamb Short Ribs",ka:"კრავის ნეკნები",ru:"Короткие Рёбра"}, description:{en:"72-hour braised lamb ribs, walnut-herb gremolata, charcoal finish",ka:"72-საათიანი კრავი",ru:"72-часовая баранина"}, price:44, image:"https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=90", ingredients:["Lamb Ribs","Walnuts","Gremolata","Charcoal Ash"], badges:["Popular"], available:true, featured:false },
  { id:7, categoryId:4, name:{en:"Heritage Tomato",ka:"ძველი ჯიშის პომიდვრები",ru:"Помидоры Хэритедж"}, description:{en:"Seven-variety tomatoes, walnut-tarragon vinaigrette, pressed herb oil",ka:"შვიდი ჯიშის პომიდვრები",ru:"Семь сортов томатов с эстрагоном"}, price:19, image:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=90", ingredients:["Heritage Tomatoes","Walnuts","Tarragon","Red Onion","Herb Oil"], badges:["Seasonal"], available:true, featured:false },
  { id:8, categoryId:5, name:{en:"Churchkhela Parfait",ka:"ჩურჩხელა პარფე",ru:"Чурчхела Парфе"}, description:{en:"Deconstructed churchkhela, Kakhetian grape gelée, walnut praline",ka:"დეკონსტრუქცია ჩურჩხელა",ru:"Деконструированная чурчхела"}, price:18, image:"https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&q=90", ingredients:["Grape Must","Walnuts","Almond Praline","Vanilla"], badges:["New"], available:true, featured:false },
  { id:9, categoryId:6, name:{en:"Saperavi Reserve",ka:"საფერავი რეზერვი",ru:"Саперави Резерв"}, description:{en:"Single vineyard Kakheti, 2018 vintage, 48-month oak aged",ka:"ერთი ვენახი, 2018",ru:"Односортовой Саперави 2018"}, price:28, image:"https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=90", ingredients:["Saperavi","Kakheti","2018 Vintage","48-month Oak"], badges:["Popular","Signature"], available:true, featured:true },
  { id:10, categoryId:6, name:{en:"Rkatsiteli Natural",ka:"რქაწითელი",ru:"Ркацители Натурал"}, description:{en:"Amphora-aged skin-contact white, golden amber hue, stone fruit",ka:"ქვევრში მომწიფებული",ru:"Вино в амфоре"}, price:22, image:"https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=90", ingredients:["Rkatsiteli","Amphora","Kakheti","Skin-Contact"], badges:["Rare"], available:true, featured:false },
];

const TABLES = [
  { id:1, name:"Table 01", zone:"Grand Hall", active:true },
  { id:2, name:"Table 02", zone:"Grand Hall", active:true },
  { id:3, name:"Salon Privé", zone:"VIP", active:true },
  { id:4, name:"Terrace I", zone:"Terrace", active:true },
  { id:5, name:"Terrace II", zone:"Terrace", active:false },
  { id:6, name:"Wine Cellar", zone:"Private", active:true },
];

/** Shared across tabs so guest menu (/) and admin (/admin) see the same alerts. */
const NOTIF_STORAGE_KEY = "tiflisi_notifications_v1";

/** Admin seating: persisted per browser (not in Supabase). */
const TABLES_STORAGE_KEY = "tiflisi_tables_v1";

/** Offline / no-Supabase: persist dish list so admin edits survive refresh (not used when live Supabase menu loads). */
const MENU_DISHES_STORAGE_KEY = "tiflisi_menu_dishes_v1";

function normalizeTableRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((t) => {
      if (!t || t.id == null || t.id === "") return null;
      const rawId = t.id;
      const id =
        typeof rawId === "number" && Number.isFinite(rawId)
          ? rawId
          : typeof rawId === "string" && /^[0-9]+$/.test(rawId.trim())
            ? Number(rawId.trim())
            : String(rawId).trim();
      const name = typeof t.name === "string" ? t.name.trim() : "";
      if (!name) return null;
      return {
        id,
        name,
        zone: typeof t.zone === "string" && t.zone.trim() ? t.zone.trim() : "Hall",
        active: t.active !== false,
      };
    })
    .filter(Boolean);
}

function loadTablesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(TABLES_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    const rows = normalizeTableRows(arr);
    return rows.length > 0 ? rows : null;
  } catch (_) {
    return null;
  }
}

function saveTablesToStorage(list) {
  try {
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(list));
  } catch (_) {}
}

function loadDishesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(MENU_DISHES_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr;
  } catch (_) {
    return null;
  }
}

function saveNotificationsToStorage(list) {
  try {
    const serializable = list.map((n) => ({
      ...n,
      time: n.time instanceof Date ? n.time.toISOString() : n.time,
    }));
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(serializable));
  } catch (_) {}
}

function loadNotificationsFromStorage() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((n) => n && typeof n === "object")
      .map((n) => ({
        ...n,
        time: n.time ? new Date(n.time) : new Date(),
        read: !!n.read,
      }));
  } catch (_) {
    return [];
  }
}

const BADGE_CFG = {
  "Signature":    { bg:"linear-gradient(135deg,#3dbfb0,#1a6b62)", color:"#ecfffb" },
  "Popular":      { bg:"linear-gradient(135deg,#a84830,#e07a62)", color:"#fff0eb" },
  "Chef's Table": { bg:"linear-gradient(135deg,#1a5c56,#2d8a7e)", color:"#d4f7f2" },
  "New":          { bg:"linear-gradient(135deg,#0d4a42,#3dbfb0)", color:"#d1fae5" },
  "Seasonal":     { bg:"linear-gradient(135deg,#1e4a45,#2fb89a)", color:"#dbeafe" },
  "Rare":         { bg:"linear-gradient(135deg,#5c2a22,#c45844)", color:"#ffe8e3" },
};

const T = {
  en:{menu:"Menu",callWaiter:"Summon Waiter",requestBill:"Request Bill",ingredients:"Provenance",soldOut:"Unavailable",table:"Table",waiterCalled:"Your waiter is on the way.",billRequested:"Your bill is being prepared.",search:"Search the menu…",all:"All",adminLogin:"Staff Access",login:"Enter",dashboard:"Overview",menuMgmt:"Cuisine",tables:"Seating",notifications:"Alerts",analytics:"Insights",logout:"Exit",addDish:"New Dish",save:"Save",cancel:"Cancel",available:"Available",featured:"Recommended",chefChoice:"Chef's choice",badges:"Distinctions",cart:"Basket",cartTotal:"Total",addToCart:"Add",cartHint:"Estimated total for your selection (reference only).",emptyCart:"Your basket is empty.",cartQty:"Qty",cartClose:"Close"},
  ka:{menu:"მენიუ",callWaiter:"მიმტანის გამოძახება",requestBill:"ანგარიშის მოთხოვნა",ingredients:"წარმომავლობა",soldOut:"მიუწვდომელი",table:"მაგიდა",waiterCalled:"მიმტანი მოდის.",billRequested:"ანგარიში მზადდება.",search:"მოძებნეთ…",all:"ყველა",adminLogin:"პერსონალი",login:"შესვლა",dashboard:"მიმოხილვა",menuMgmt:"სამზარეულო",tables:"მოსასვლელი",notifications:"შეტყობინებები",analytics:"ანალიტიკა",logout:"გამოსვლა",addDish:"ახალი კერძი",save:"შენახვა",cancel:"გაუქმება",available:"ხელმისაწვდომი",featured:"რეკომენდებული",chefChoice:"შეფის არჩევანი",badges:"გამოჩენილი",cart:"კალათა",cartTotal:"ჯამი",addToCart:"დამატება",cartHint:"არჩეული კერძების სავარაუდო ჯამი (საინფორმაციოდ).",emptyCart:"კალათა ცარიელია.",cartQty:"რაოდ.",cartClose:"დახურვა"},
  ru:{menu:"Меню",callWaiter:"Позвать Официанта",requestBill:"Попросить Счёт",ingredients:"Происхождение",soldOut:"Недоступно",table:"Стол",waiterCalled:"Официант уже идёт.",billRequested:"Счёт готовится.",search:"Поиск…",all:"Все",adminLogin:"Персонал",login:"Войти",dashboard:"Обзор",menuMgmt:"Кухня",tables:"Места",notifications:"Оповещения",analytics:"Аналитика",logout:"Выйти",addDish:"Новое Блюдо",save:"Сохранить",cancel:"Отмена",available:"Доступно",featured:"Рекомендуем",chefChoice:"Выбор шефа",badges:"Отличия",cart:"Корзина",cartTotal:"Итого",addToCart:"В корзину",cartHint:"Ориентировочная сумма выбранных блюд (справочно).",emptyCart:"Корзина пуста.",cartQty:"Кол-во",cartClose:"Закрыть"},
};

/* ─── SHARED STATE ───────────────────────────────────────────────────────── */
function useStore() {
  const supabaseEnabled = isSupabaseConfigured();
  const [categories, setCategories] = useState(() => (supabaseEnabled ? [] : CATEGORIES));
  const [dishes, setDishes] = useState(() => {
    if (supabaseEnabled) return [];
    return loadDishesFromLocalStorage() ?? DISHES;
  });
  const [menuLoading, setMenuLoading] = useState(supabaseEnabled);
  const [menuError, setMenuError] = useState(null);
  const [tables, setTables] = useState(() => (supabaseEnabled ? [] : (loadTablesFromLocalStorage() ?? TABLES)));
  const [tablesLoading, setTablesLoading] = useState(!!supabaseEnabled);
  const [tablesError, setTablesError] = useState(null);
  const [notifications, setNotificationsState] = useState(loadNotificationsFromStorage);
  const [analytics, setAnalytics] = useState({ scans: 247, views: { 1:18, 2:24, 3:31, 5:42, 9:28 } });

  const setNotifications = useCallback((updater) => {
    setNotificationsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveNotificationsToStorage(next);
      return next;
    });
  }, []);

  const addNotification = useCallback((note) => {
    setNotificationsState((prev) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const row = { ...note, id, time: new Date(), read: false };
      const next = [row, ...prev].slice(0, 60);
      saveNotificationsToStorage(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== NOTIF_STORAGE_KEY || e.newValue == null) return;
      try {
        const arr = JSON.parse(e.newValue);
        if (!Array.isArray(arr)) return;
        const next = arr.map((n) => ({
          ...n,
          time: n.time ? new Date(n.time) : new Date(),
          read: !!n.read,
        }));
        setNotificationsState(next);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const trackView = useCallback((id) => {
    const key = id == null ? "" : String(id);
    if (!key) return;
    setAnalytics((prev) => ({
      ...prev,
      scans: prev.scans + 1,
      views: { ...prev.views, [key]: (prev.views[key] || 0) + 1 },
    }));
  }, []);

  const clearMenuError = useCallback(() => setMenuError(null), []);

  const reloadMenuFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setMenuLoading(true);
    setMenuError(null);
    const reasonText = (settled) => {
      const x = settled?.reason;
      if (x instanceof Error) return x.message;
      if (typeof x === "string") return x;
      if (x != null && typeof x === "object" && "message" in x) return String(x.message);
      return x != null ? String(x) : "";
    };
    const [dishResult, catResult] = await Promise.allSettled([fetchMenuDishes(), fetchMenuCategories()]);
    let dishErr = null;
    if (dishResult.status === "fulfilled") {
      setDishes(dishResult.value);
    } else {
      dishErr = reasonText(dishResult) || "Could not load menu";
      setDishes([]);
    }
    if (catResult.status === "fulfilled") {
      setCategories(catResult.value);
    } else {
      setCategories([]);
      if (!dishErr) {
        dishErr =
          reasonText(catResult) || "Could not load menu categories (run SQL for public.menu_categories)";
      }
    }
    setMenuError(dishErr || null);
    setMenuLoading(false);
  }, []);

  const reloadSeatingFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setTablesError(null);
    try {
      const rows = await fetchSeatingTables();
      setTables(rows);
    } catch (e) {
      setTablesError(e?.message || "Could not load seating");
      setTables(TABLES);
    }
  }, []);

  const addTableRow = useCallback(
    async (name, zone) => {
      if (!supabaseEnabled) {
        setTables((p) => [...p, { id: Date.now(), name: String(name).trim(), zone, active: true }]);
        return;
      }
      await insertSeatingTable({ name, zone });
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, reloadSeatingFromSupabase]
  );

  const toggleTableRow = useCallback(
    async (id) => {
      if (!supabaseEnabled) {
        setTables((p) => p.map((t) => (String(t.id) === String(id) ? { ...t, active: !t.active } : t)));
        return;
      }
      const row = tables.find((t) => String(t.id) === String(id));
      if (!row) return;
      await updateSeatingTable(id, { active: !row.active });
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, tables, reloadSeatingFromSupabase]
  );

  const removeTableRow = useCallback(
    async (id) => {
      if (!supabaseEnabled) {
        setTables((p) => p.filter((t) => String(t.id) !== String(id)));
        return;
      }
      await deleteSeatingTable(id);
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, reloadSeatingFromSupabase]
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    reloadMenuFromSupabase();
  }, [supabaseEnabled, reloadMenuFromSupabase]);

  /** Offline only: persist dishes in localStorage (never when Supabase env is set). */
  useEffect(() => {
    if (supabaseEnabled) return;
    try {
      localStorage.setItem(MENU_DISHES_STORAGE_KEY, JSON.stringify(dishes));
    } catch (_) {}
  }, [dishes, supabaseEnabled]);

  /** Offline: other tabs pick up localStorage menu changes. */
  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== MENU_DISHES_STORAGE_KEY || e.newValue == null) return;
      try {
        const arr = JSON.parse(e.newValue);
        if (!Array.isArray(arr)) return;
        setDishes(arr);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [supabaseEnabled]);

  useEffect(() => {
    if (supabaseEnabled) return;
    saveTablesToStorage(tables);
  }, [tables, supabaseEnabled]);

  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== TABLES_STORAGE_KEY || e.newValue == null) return;
      try {
        const rows = normalizeTableRows(JSON.parse(e.newValue));
        if (rows.length > 0) setTables(rows);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [supabaseEnabled]);

  /** Supabase: load seating + optional Realtime sync (enable `seating` in Replication if updates do not propagate). */
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    let cancelled = false;
    setTablesLoading(true);
    setTablesError(null);
    fetchSeatingTables()
      .then((rows) => {
        if (!cancelled) setTables(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setTablesError(e?.message || "Seating load failed");
          setTables(TABLES);
        }
      })
      .finally(() => {
        if (!cancelled) setTablesLoading(false);
      });

    const ch = supabase
      .channel("seating_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seating" },
        () => {
          fetchSeatingTables()
            .then((rows) => {
              if (!cancelled) setTables(rows);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [supabaseEnabled]);

  return {
    categories,
    setCategories,
    dishes,
    setDishes,
    tables,
    tablesLoading,
    tablesError,
    addTableRow,
    toggleTableRow,
    removeTableRow,
    reloadSeatingFromSupabase,
    notifications,
    setNotifications,
    addNotification,
    analytics,
    trackView,
    menuLoading,
    menuError,
    clearMenuError,
    reloadMenuFromSupabase,
  };
}

/** Guest menu — header links (override with VITE_LINK_* in .env.local). */
const SOCIAL_TOP_ITEMS = [
  {
    env: "VITE_LINK_FACEBOOK",
    label: "Facebook",
    brand: "facebook",
    fallback: "https://www.facebook.com/TiflisiRestaurantBatumi/",
    bg: "#1877F2",
    border: "#1877F2",
    mode: "icon",
  },
  {
    env: "VITE_LINK_INSTAGRAM",
    label: "Instagram",
    brand: "instagram",
    fallback: "https://www.instagram.com/tiflisirestaurantbatumi/",
    bg: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    border: "rgba(255,255,255,0.25)",
    mode: "icon",
  },
  {
    env: "VITE_LINK_GOOGLE",
    label: "Google",
    brand: "googlemaps",
    fallback: "https://g.page/r/CcKkKc1ypmCgEAE/review",
    bg: "#4285F4",
    border: "#4285F4",
    mode: "icon",
  },
  {
    env: "VITE_LINK_TRIPADVISOR",
    label: "Tripadvisor",
    brand: "tripadvisor",
    fallback: "https://www.tripadvisor.com/Search?q=Tiflisi+Batumi",
    bg: "#00AF87",
    border: "#00AF87",
    mode: "icon",
  },
  {
    env: "VITE_LINK_WOLT",
    label: "Wolt",
    fallback:
      "https://wolt.com/en/geo/batumi/restaurant/restaurant-tiflis",
    bg: "#009FE3",
    border: "#0088c7",
    fg: "#ffffff",
    text: "Wolt",
    mode: "text",
  },
  {
    env: "VITE_LINK_GLOVO",
    label: "Glovo",
    fallback:
      "https://glovoapp.com/en/ge/batumi/stores/tiflisi-bat?content=pitsa-c.1421345036&section=pitsa-s.2999510380",
    bg: "#FDBF00",
    border: "#E5AC00",
    fg: "#1a1204",
    text: "Glovo",
    mode: "text",
  },
  {
    env: "VITE_LINK_BOLT",
    label: "Bolt Food",
    fallback: "https://food.bolt.eu/ka-ge/38-batumi/p/67460-restorani-tiplisi/",
    bg: "#34D186",
    border: "#2ABF75",
    fg: "#041012",
    text: "Bolt",
    mode: "text",
  },
];

function socialTopHref(envKey, fallback) {
  const v = import.meta.env[envKey];
  if (v != null && String(v).trim() !== "") return String(v).trim();
  return fallback;
}

/** Solid accent for glow / icon tint (SOCIAL_TOP_ITEMS border/bg may be gradient). */
function socialAccentFromItem(item) {
  if (typeof item.border === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(item.border)) return item.border;
  if (item.brand === "instagram") return "#E1306C";
  if (item.brand === "facebook") return "#1877F2";
  if (item.brand === "googlemaps") return "#4285F4";
  if (item.brand === "tripadvisor") return "#00AF87";
  return "#3dbfb0";
}

function SocialTopStrip({ className = "" }) {
  const iconBase = "https://cdn.jsdelivr.net/npm/simple-icons@11.6.0/icons";
  return (
    <div className={["social-top-strip", className].filter(Boolean).join(" ")} role="navigation" aria-label="Social & delivery">
      {SOCIAL_TOP_ITEMS.map((item) => {
        const href = socialTopHref(item.env, item.fallback);
        const isText = item.mode === "text";
        const accent = socialAccentFromItem(item);
        const iconUrl = `${iconBase}/${item.brand}.svg`;
        const useGradientIcon = !isText && typeof item.bg === "string" && item.bg.includes("gradient");
        return (
          <a
            key={item.env}
            className={`social-top-link ${isText ? "social-top-link--text" : "social-top-link--icon"}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={item.label}
            aria-label={item.label}
            style={{
              ["--social-accent"]: accent,
              ["--social-icon-url"]: `url("${iconUrl}")`,
              ...(useGradientIcon ? { ["--social-icon-gradient"]: item.bg } : {}),
            }}
          >
            {isText ? (
              item.text
            ) : (
              <span
                className={`social-top-link__icon-mask${useGradientIcon ? " social-top-link__icon-mask--gradient" : ""}`}
                aria-hidden="true"
              />
            )}
          </a>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOMER MENU
═══════════════════════════════════════════════════════════════════════════ */
function CustomerMenu({ tableId, store, lang }) {
  const t = T[lang];
  const { categories, dishes, tables, addNotification, trackView, menuLoading, menuError } = store;
  const supabaseMenu = isSupabaseConfigured();
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const catRefs = useRef({});
  const headerRef = useRef(null);
  const catScrollRef = useRef(null);
  const menuTopRef = useRef(null);
  const skipScrollSpyRef = useRef(false);
  const chipCenterRequestedRef = useRef(false);
  const table = tables.find((tb) => String(tb.id) === String(tableId)) || { name: `Table ${tableId}`, zone: "Hall" };

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([idStr, qty]) => ({ id: idStr, qty: Number(qty) || 0 }))
      .filter(({ qty }) => qty > 0)
      .map(({ id, qty }) => {
        const dish = dishes.find((d) => String(d.id) === id);
        if (!dish || !dish.available) return null;
        const unitCents = priceToCents(dish.price);
        const lineTotal = (unitCents * qty) / 100;
        return { dish, qty, lineTotal };
      })
      .filter(Boolean);
  }, [cart, dishes]);

  const cartGrandTotal = useMemo(
    () => cartLines.reduce((s, l) => s + priceToCents(l.dish.price) * l.qty, 0) / 100,
    [cartLines]
  );
  const cartItemCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);

  const addToCart = useCallback((dish) => {
    if (!dish?.available) return;
    setCart((c) => ({ ...c, [dish.id]: (c[dish.id] || 0) + 1 }));
  }, []);

  const bumpCartQty = useCallback((dishId, delta) => {
    setCart((c) => {
      const prev = c[dishId] || 0;
      const next = prev + delta;
      if (next <= 0) {
        const { [dishId]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [dishId]: next };
    });
  }, []);

  useEffect(() => {
    if (cartItemCount === 0) setCartOpen(false);
  }, [cartItemCount]);

  /** Drop cart lines for dishes removed from the menu (e.g. after Supabase reload). */
  useEffect(() => {
    if (dishes.length === 0) return;
    const ids = new Set(dishes.map((d) => String(d.id)));
    setCart((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (!ids.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dishes]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const callWaiter = () => { addNotification({ type:"waiter", tableId, tableName:table.name, message:"Waiter Request" }); showToast(t.waiterCalled); };
  const requestBill = () => { addNotification({ type:"bill", tableId, tableName:table.name, message:"Bill Request" }); showToast(t.billRequested); };

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);

  const ORPHAN_CAT_KEY = "__orphan__";
  const MENU_TOP_SECTION_ID = "menu-section-top";
  const sectionIdForCategory = (catId) =>
    catId === ORPHAN_CAT_KEY ? "menu-section-orphan" : `menu-section-${String(catId)}`;

  /** Search only — category chips scroll to section (no hide-other-categories; avoids wrong scroll after filter). */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => {
      const nm = d?.name && typeof d.name === "object" ? d.name : {};
      const label = String(nm[lang] || nm.en || "").toLowerCase();
      return !q || label.includes(q);
    });
  }, [dishes, search, lang]);

  const grouped = useMemo(() => {
    const byOrder = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id));
    const base = sortedCategories
      .map((cat) => ({
        ...cat,
        dishes: filtered.filter((d) => d.categoryId === cat.id).sort(byOrder),
      }))
      .filter((c) => c.dishes.length > 0);
    const orphan = filtered.filter((d) => !sortedCategories.some((c) => c.id === d.categoryId)).sort(byOrder);
    if (orphan.length === 0) return base;
    return [
      ...base,
      {
        id: ORPHAN_CAT_KEY,
        name: { en: "Other", ka: "სხვა", ru: "Прочее" },
        icon: "◇",
        order: 999999,
        dishes: orphan,
      },
    ];
  }, [sortedCategories, filtered]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stickyOffset = () => (headerRef.current?.offsetHeight ?? 120) + 12;

  const scrollToSection = useCallback((sectionId) => {
    if (typeof document === "undefined") return false;
    const element = document.getElementById(sectionId);
    if (!element) return false;
    element.style.scrollMarginTop = `${stickyOffset()}px`;
    const top = window.scrollY + element.getBoundingClientRect().top - stickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    return true;
  }, []);

  const scrollTo = useCallback((id) => {
    skipScrollSpyRef.current = true;
    chipCenterRequestedRef.current = true;
    setActiveCat(id);
    const sectionId = sectionIdForCategory(id);

    let tries = 0;
    const tryScroll = () => {
      if (scrollToSection(sectionId)) return;
      // Sections can mount a frame later right after filter / state transitions.
      tries += 1;
      if (tries < 12) requestAnimationFrame(tryScroll);
    };
    tryScroll();

    window.setTimeout(() => {
      skipScrollSpyRef.current = false;
    }, 950);
  }, [scrollToSection]);

  const scrollToMenuTop = useCallback(() => {
    skipScrollSpyRef.current = true;
    chipCenterRequestedRef.current = true;
    setActiveCat(null);
    if (!scrollToSection(MENU_TOP_SECTION_ID)) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    window.setTimeout(() => {
      skipScrollSpyRef.current = false;
    }, 950);
  }, [scrollToSection]);

  /** Sync active category chip with scroll position (spy). */
  useEffect(() => {
    const updateActiveFromScroll = () => {
      if (skipScrollSpyRef.current) return;
      const nav = headerRef.current;
      if (!nav) return;
      const line = nav.getBoundingClientRect().bottom + 10;
      let current = grouped[0]?.id ?? null;
      for (const cat of grouped) {
        const el = catRefs.current[String(cat.id)];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= line) current = cat.id;
      }
      const nearBottom =
        typeof window !== "undefined" &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (nearBottom && grouped.length > 0) {
        current = grouped[grouped.length - 1].id;
      }
      setActiveCat((prev) => (String(prev) === String(current) ? prev : current));
    };

    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateActiveFromScroll();
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    updateActiveFromScroll();
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [grouped]);

  /** Keep chip strip stable while page scrolls; center chip only for explicit clicks. */
  useLayoutEffect(() => {
    if (!chipCenterRequestedRef.current) return;
    chipCenterRequestedRef.current = false;
    const wrap = catScrollRef.current;
    if (!wrap) return;
    const key = activeCat == null ? "all" : String(activeCat);
    const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const btn = wrap.querySelector(`[data-cat-tab="${esc}"]`);
    if (btn) {
      const targetLeft = btn.offsetLeft - (wrap.clientWidth - btn.offsetWidth) / 2;
      wrap.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
    }
  }, [activeCat]);

  return (
    <div className="menu-page-shell" style={{ color:"var(--cream)", fontFamily:"var(--font-body)" }}>
      <GlobalStyles /><FontLoader />
      <div className="noise" />

      {/* HERO — compact, matches welcome luxury language */}
      <div className="menu-hero-strip">
        <div style={{ position:"relative", zIndex:3, height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:"12px", animation:"fadeIn 0.9s ease" }}>
          <div style={{ fontSize:"9px", letterSpacing:"0.55em", color:"#c9a962", textTransform:"uppercase", marginBottom:"8px", fontFamily:"var(--font-body)", fontWeight:600 }}>
            Georgian fine dining
          </div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"clamp(36px,9vw,56px)", fontWeight:300, color:"var(--cream)", letterSpacing:"0.06em", lineHeight:1, fontStyle:"italic" }}>
            Tiflisi
          </div>
          <div style={{ marginTop:"10px", display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"36px", height:"1px", background:"linear-gradient(90deg, transparent, rgba(201,169,98,0.6))" }} />
            <span style={{ fontSize:"9px", color:"rgba(109,143,137,0.95)", letterSpacing:"0.28em", textTransform:"uppercase" }}>{t.table} · {table.name}</span>
            <div style={{ width:"36px", height:"1px", background:"linear-gradient(90deg, rgba(201,169,98,0.6), transparent)" }} />
          </div>
        </div>
      </div>

      {/* STICKY NAV */}
      <div ref={headerRef} className="menu-sticky-nav" style={{ position: "sticky", top: 0, zIndex: 100, overflowAnchor: "none" }}>
        <div className="menu-sticky-nav-inner">
          <div className="menu-search-wrap">
            <span className="menu-search-icon" aria-hidden="true">✦</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="menu-search-input"
            />
          </div>

          <div ref={catScrollRef} className="menu-cat-scroll">
            <CatBtn
              tabKey="all"
              active={!activeCat}
              onClick={scrollToMenuTop}
              label={t.all}
            />
            {/* One chip per rendered section only — was sortedCategories (orphan sections missing → scroll found no el). */}
            {grouped.map((c) => (
              <CatBtn
                key={c.id}
                tabKey={c.id}
                active={activeCat != null && String(activeCat) === String(c.id)}
                onClick={() => scrollTo(c.id)}
                label={c.id === ORPHAN_CAT_KEY ? (lang === "ka" ? "სხვა" : lang === "ru" ? "Прочее" : "Other") : c.name[lang]}
                icon={c.icon}
              />
            ))}
          </div>
        </div>
      </div>

      {menuError && (
        <div style={{ margin:"0 16px 12px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", letterSpacing:"0.2px", lineHeight:1.5 }}>
          {menuError}
        </div>
      )}

      {/* DISH SECTIONS — bottom padding clears fixed dock + home indicator */}
      <div
        ref={menuTopRef}
        id={MENU_TOP_SECTION_ID}
        className={`menu-main-column${cartItemCount > 0 ? " menu-main-column--cart" : ""}`}
        style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}
      >
        {menuLoading && dishes.length === 0 && (
          <div style={{ textAlign:"center", padding:"80px 20px", fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--muted)" }}>
            Loading menu…
          </div>
        )}
        {!menuLoading && dishes.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", fontSize:"13px", color:"var(--muted)", lineHeight:1.6 }}>
            {supabaseMenu
              ? "მენიუ იტვირთება Supabase-იდან — ცარიელია ან ჩატვირთვა ვერ მოხერხდა. შეამოწმე SQL/RLS ან დაამატე კერძები Admin → Cuisine / Cloud-იდან."
              : <>No dishes to show. Add dishes in <strong style={{ color:"var(--cream)" }}>Admin → Cuisine</strong> (stored in this browser) or enable Supabase.</>}
          </div>
        )}
        {grouped.map((cat, gi) => (
          <div
            key={cat.id}
            id={sectionIdForCategory(cat.id)}
            className="menu-cat-section-anchor"
            ref={(el) => {
              const k = String(cat.id);
              if (el) catRefs.current[k] = el;
              else delete catRefs.current[k];
            }}
            style={{ marginTop: gi === 0 ? 28 : 44 }}
          >
            <div className="menu-section-head">
              <span className="menu-section-icon" aria-hidden="true">{cat.icon}</span>
              <h2 className="menu-section-title">{cat.name[lang]}</h2>
              <div className="menu-section-line" aria-hidden="true" />
            </div>
            <div className="menu-dish-list">
              {cat.dishes.map((dish, di) => (
                <DishRow key={dish.id} dish={dish} lang={lang} t={t}
                  style={{ animationDelay:`${(gi*3+di)*0.06}s` }}
                  expanded={expanded===dish.id}
                  onToggle={() => { setExpanded(expanded===dish.id?null:dish.id); trackView(dish.id); }}
                  cartQty={cart[dish.id] || 0}
                  onAddToCart={addToCart}
                  onBumpCartQty={bumpCartQty} />
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop:"56px", textAlign:"center", padding:"32px 0 8px" }}>
          <div style={{ width:"1px", height:"36px", background:"linear-gradient(180deg,transparent,rgba(201,169,98,0.55),transparent)", margin:"0 auto 14px" }} />
          <div style={{ fontFamily:"var(--font-display)", fontSize:"12px", color:"rgba(109,143,137,0.9)", fontStyle:"italic", letterSpacing:"0.12em" }}>
            All dishes prepared with the finest Georgian ingredients
          </div>
        </div>
      </div>

      {/* CART SHEET */}
      {cartOpen && (
        <>
          <button
            type="button"
            aria-label={t.cartClose}
            onClick={() => setCartOpen(false)}
            style={{
              position:"fixed", inset:0, zIndex:10120, border:"none", padding:0, margin:0,
              background:"rgba(0,0,0,0.72)", cursor:"pointer", WebkitTapHighlightColor:"transparent",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-sheet-title"
            className="menu-cart-sheet"
            style={{
              position:"fixed", left:0, right:0, bottom:0, zIndex:10130, maxHeight:"72vh",
              borderRadius:"20px 20px 0 0",
              display:"flex", flexDirection:"column", animation:"menuSheetUp 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div id="cart-sheet-title" style={{ fontFamily:"var(--font-display)", fontSize:"22px", fontStyle:"italic", color:"var(--cream)" }}>{t.cart}</div>
              <button type="button" onClick={() => setCartOpen(false)} className="action-btn menu-cart-sheet-close">{t.cancel}</button>
            </div>
            <div style={{ overflowY:"auto", flex:1, padding:"12px 18px" }}>
              {cartLines.length === 0 ? (
                <div style={{ textAlign:"center", padding:"36px 12px", color:"var(--muted)", fontSize:"13px", fontFamily:"var(--font-display)", fontStyle:"italic" }}>{t.emptyCart}</div>
              ) : (
                cartLines.map(({ dish, qty, lineTotal }) => (
                  <div key={dish.id} style={{
                    display:"flex", gap:"12px", alignItems:"center", padding:"12px 0",
                    borderBottom:"1px solid rgba(255,255,255,0.05)",
                  }}>
                    <img
                      src={dish.image}
                      alt=""
                      width={52}
                      height={52}
                      loading="lazy"
                      decoding="async"
                      style={{ width:"52px", height:"52px", objectFit:"cover", borderRadius:"2px", flexShrink:0 }}
                    />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--font-display)", fontSize:"15px", color:"var(--cream)", lineHeight:1.25 }}>{dish.name[lang]}</div>
                      <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"4px" }}>₾{formatLari(dish.price)} × {qty}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:"4px", flexShrink:0 }}>
                      <button type="button" className="menu-cart-sheet-qty-btn" aria-label={t.cartQty + " −"} onClick={() => bumpCartQty(dish.id, -1)}>−</button>
                      <span style={{ minWidth:"22px", textAlign:"center", fontSize:"12px", color:"var(--gold-pale)", fontWeight:600 }}>{qty}</span>
                      <button
                        type="button"
                        className={`menu-cart-sheet-qty-btn menu-cart-sheet-qty-btn--plus`}
                        aria-label={t.cartQty + " +"}
                        onClick={() => dish.available && bumpCartQty(dish.id, 1)}
                        disabled={!dish.available}
                      >+</button>
                    </div>
                    <div style={{ fontFamily:"var(--font-display)", fontSize:"17px", color:"var(--gold-light)", flexShrink:0, minWidth:"56px", textAlign:"right" }}>₾{formatLari(lineTotal)}</div>
                  </div>
                ))
              )}
            </div>
            {cartLines.length > 0 && (
              <div style={{ padding:"16px 18px 22px", borderTop:"1px solid rgba(61,191,176,0.12)", flexShrink:0, background:"rgba(7,6,8,0.5)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"10px" }}>
                  <span style={{ fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase", color:"var(--gold)" }}>{t.cartTotal}</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:"32px", fontWeight:300, color:"var(--gold-light)" }}>₾{formatLari(cartGrandTotal)}</span>
                </div>
                <div style={{ fontSize:"10px", color:"var(--muted)", lineHeight:1.5, letterSpacing:"0.2px" }}>{t.cartHint}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* BOTTOM ACTIONS — full-width fixed strip; cart CTA stays above thumb reach */}
      <div className="menu-bottom-dock">
        <div className="menu-bottom-dock-inner">
          <div className="menu-cart-bar">
            {cartItemCount > 0 && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="action-btn menu-cart-open-btn"
                aria-label={`${t.cart}, ${cartItemCount}, ₾${formatLari(cartGrandTotal)}`}
              >
                <span style={{ fontSize:"9px", letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(244,241,234,0.9)" }}>{t.cart}</span>
                <span style={{ fontSize:"11px", color:"rgba(109,143,137,0.95)", letterSpacing:"0.08em" }}>{cartItemCount}</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:"clamp(1.15rem,4vw,1.4rem)", fontWeight:300, color:"#c9a962", marginLeft:"auto" }}>₾{formatLari(cartGrandTotal)}</span>
                <span style={{ fontSize:"11px", color:"rgba(201,169,98,0.55)" }} aria-hidden="true">▴</span>
              </button>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <button type="button" onClick={callWaiter} className="action-btn menu-service-btn menu-service-btn--waiter">
                ✦ {t.callWaiter}
              </button>
              <button type="button" onClick={requestBill} className="action-btn menu-service-btn menu-service-btn--bill">
                ◇ {t.requestBill}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", top:"100px", left:"50%",
          transform:"translateX(-50%)", zIndex:10140,
          background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.4)",
          color:"var(--gold-pale)", padding:"14px 28px",
          fontFamily:"var(--font-body)", fontSize:"12px", letterSpacing:"1.5px",
          boxShadow:"0 20px 60px rgba(0,0,0,0.8)", whiteSpace:"nowrap",
          animation:"toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CatBtn({ active, onClick, label, icon, tabKey }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`menu-cat-tab${active ? " menu-cat-tab--active" : ""}`}
      {...(tabKey != null ? { "data-cat-tab": String(tabKey) } : {})}
    >
      {icon && <span style={{ marginRight: "7px", opacity: active ? 1 : 0.65 }}>{icon}</span>}
      {label}
    </button>
  );
}

function dishBlurbText(dish, lang) {
  const d = dish?.description && typeof dish.description === "object" ? dish.description : {};
  const order = lang === "ka" ? ["ka", "en", "ru"] : lang === "ru" ? ["ru", "en", "ka"] : ["en", "ka", "ru"];
  for (const k of order) {
    const s = String(d[k] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function DishRow({ dish, lang, t, expanded, onToggle, style, cartQty = 0, onAddToCart, onBumpCartQty }) {
  const [addPulse, setAddPulse] = useState(false);
  const addPulseTimerRef = useRef(null);
  const nameObj = dish.name && typeof dish.name === "object" ? dish.name : {};
  const title = String(nameObj[lang] || nameObj.en || nameObj.ka || "—").trim() || "—";
  const blurb = dishBlurbText(dish, lang);
  const badges = Array.isArray(dish.badges) ? dish.badges : [];
  const displayBadges = dish.featured ? badges.filter((b) => b !== "Chef's Table") : badges;
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];

  const badgeLine = (b) => (b === "Chef's Table" ? t.chefChoice : b);

  useEffect(() => {
    return () => {
      if (addPulseTimerRef.current) clearTimeout(addPulseTimerRef.current);
    };
  }, []);

  const triggerAddPulse = () => {
    if (addPulseTimerRef.current) clearTimeout(addPulseTimerRef.current);
    setAddPulse(true);
    addPulseTimerRef.current = setTimeout(() => {
      setAddPulse(false);
      addPulseTimerRef.current = null;
    }, 520);
  };

  return (
    <div
      className={`dish-card menu-dish-card${expanded ? " menu-dish-card--expanded" : ""}`}
      onClick={onToggle}
      style={{
        cursor: "pointer",
        opacity: dish.available ? 1 : 0.48,
        ...style,
      }}
    >
      <div className="dish-card-inner">
        <div className="dish-card-media">
          {dish.image ? (
            <img
              src={dish.image}
              alt={title}
              className="dish-img"
              loading="lazy"
              decoding="async"
              style={{
                filter: dish.available ? "none" : "grayscale(1)",
              }}
            />
          ) : (
            <div className="dish-img-placeholder">Image</div>
          )}
          {!dish.available && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,8,8,0.82)", pointerEvents:"none" }}>
              <span style={{ fontSize:"9px", letterSpacing:"0.2em", color:"rgba(238,246,244,0.75)", textTransform:"uppercase", fontFamily:"var(--font-body)", fontWeight:600 }}>{t.soldOut}</span>
            </div>
          )}
          {dish.featured && (
            <div style={{ position:"absolute", top:"10px", left:"10px", pointerEvents:"none" }}>
              <span className="menu-feature-pill" aria-label={t.chefChoice}>✦ {t.chefChoice}</span>
            </div>
          )}
        </div>

        <div className="menu-dish-card-body" style={{ flex:1, padding:"16px 18px", display:"flex", flexDirection:"column", justifyContent:"space-between", minWidth:0 }}>
          <div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px", alignItems:"center" }}>
              {displayBadges.map((b, bi) => (
                <span
                  key={`${dish.id}-b-${bi}-${b}`}
                  className="tag"
                  style={{
                    background: BADGE_CFG[b]?.bg || "#333",
                    color: BADGE_CFG[b]?.color || "#fff",
                    fontSize: "8px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-body)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {b === "Popular" && <span aria-hidden="true">🔥&nbsp;</span>}
                  {badgeLine(b)}
                </span>
              ))}
            </div>
            <div className="menu-dish-name">{title}</div>
            {blurb ? (
              <div
                className="menu-dish-blurb"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: expanded ? "pre-wrap" : "normal",
                  ...(expanded
                    ? { overflow: "visible", maxHeight: "none", display: "block" }
                    : {
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        lineClamp: 3,
                        maxHeight: "4.8em",
                      }),
                }}
              >
                {blurb}
              </div>
            ) : null}
          </div>
          <div className="menu-dish-price-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:"12px", gap:"10px" }}>
            <div className="menu-dish-price">₾{formatLari(dish.price)}</div>
            <div className="menu-dish-price-controls" style={{ display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ display:"flex", alignItems:"center", gap:"6px" }}
              >
                {cartQty > 0 && (
                  <>
                    <button type="button" className="menu-cart-step" aria-label={t.cartQty + " −"} onClick={() => onBumpCartQty(dish.id, -1)}>−</button>
                    <span style={{ minWidth:"20px", textAlign:"center", fontSize:"12px", fontWeight:600, color:"rgba(212,247,242,0.95)" }}>{cartQty}</span>
                    <button
                      type="button"
                      className={`menu-cart-step menu-cart-step--plus${addPulse ? " menu-cart-step--pulse" : ""}`}
                      aria-label={t.cartQty + " +"}
                      disabled={!dish.available}
                      onClick={() => {
                        if (!dish.available) return;
                        onBumpCartQty(dish.id, 1);
                        triggerAddPulse();
                      }}
                      style={{ opacity: dish.available ? 1 : 0.35, cursor: dish.available ? "pointer" : "not-allowed" }}
                    >
                      +
                    </button>
                  </>
                )}
                {cartQty === 0 && (
                  <button
                    type="button"
                    className={`menu-add-btn${addPulse ? " menu-add-btn--pulse" : ""}`}
                    disabled={!dish.available}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dish.available) return;
                      onAddToCart(dish);
                      triggerAddPulse();
                    }}
                  >
                    {t.addToCart}
                  </button>
                )}
              </div>
              <div className="menu-expand-chevron" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden="true">▾</div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="menu-dish-expanded" onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize:"8px", color:"#c9a962", letterSpacing:"0.28em", textTransform:"uppercase", marginBottom:"12px", fontFamily:"var(--font-body)", fontWeight:600 }}>
            ✦ {t.ingredients}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {ingredients.map((ing, ii) => (
              <span
                key={`${dish.id}-ing-${ii}-${ing}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(61,191,176,0.22)",
                  fontSize: "10px",
                  color: "rgba(212,247,242,0.9)",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  background: "rgba(6,12,12,0.45)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN LOGIN
═══════════════════════════════════════════════════════════════════════════ */
function AdminLogin({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(false);
  const submit = () => { if (u==="admin"&&p==="tiflisi2024") onLogin(); else setErr(true); };

  return (
    <div style={{ minHeight:"100vh", background:"var(--obsidian)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-body)", position:"relative" }}>
      <GlobalStyles /><FontLoader />
      <div className="noise" />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 70%, rgba(196,88,68,0.07) 0%, transparent 50%), radial-gradient(ellipse at 50% 30%, rgba(61,191,176,0.08) 0%, transparent 60%)" }} />

      <div style={{ width:"380px", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:"48px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"5px", color:"var(--gold)", textTransform:"uppercase", marginBottom:"14px" }}>STAFF ACCESS</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"52px", fontWeight:300, fontStyle:"italic", color:"var(--cream)", lineHeight:1 }}>Tiflisi</div>
          <div style={{ marginTop:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, transparent, var(--gold))" }} />
            <span style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"3px" }}>ADMIN PANEL</span>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, var(--gold), transparent)" }} />
          </div>
        </div>

        <div style={{ background:"rgba(26,22,32,0.8)", border:"1px solid rgba(61,191,176,0.15)", padding:"40px", backdropFilter:"blur(20px)" }}>
          {[{label:"Username",val:u,set:setU,type:"text"},{label:"Password",val:p,set:setP,type:"password"}].map(f => (
            <div key={f.label} style={{ marginBottom:"20px" }}>
              <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"8px" }}>{f.label}</div>
              <input value={f.val} onChange={e=>{f.set(e.target.value);setErr(false);}} type={f.type}
                onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{ width:"100%", padding:"12px 0", background:"transparent", border:"none", borderBottom:`1px solid ${err?"#ef4444":"rgba(61,191,176,0.25)"}`, color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", letterSpacing:"1px", boxSizing:"border-box" }} />
            </div>
          ))}
          {err && <div style={{ color:"#ef4444", fontSize:"10px", letterSpacing:"1px", marginBottom:"16px" }}>INVALID CREDENTIALS</div>}
          <div style={{ fontSize:"9px", color:"var(--muted)", marginBottom:"20px", letterSpacing:"1px" }}>admin / tiflisi2024</div>
          <button onClick={submit} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg, rgba(61,191,176,0.2), rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"10px", fontWeight:"600", letterSpacing:"4px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)", transition:"all 0.3s" }}>
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}

/** Supabase: upload image to Storage, insert row into public.menu (see supabase/schema.sql). */
function AdminCloudMenu({ store }) {
  const { categories, dishes, reloadMenuFromSupabase, menuLoading } = store;
  const sortedCats = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);
  const [categoryId, setCategoryId] = useState(() => sortedCats[0]?.id ?? "");
  const [existingDishId, setExistingDishId] = useState("");

  const dishOptions = useMemo(() => {
    const catOrder = new Map(sortedCats.map((c, i) => [c.id, i]));
    return [...dishes].sort((a, b) => {
      const oa = catOrder.get(a.categoryId) ?? 999;
      const ob = catOrder.get(b.categoryId) ?? 999;
      if (oa !== ob) return oa - ob;
      const ord = (a.order ?? 0) - (b.order ?? 0);
      if (ord !== 0) return ord;
      const ta = a.name?.en || a.name?.ka || "";
      const tb = b.name?.en || b.name?.ka || "";
      return ta.localeCompare(tb, "ka");
    });
  }, [dishes, sortedCats]);

  const selectedDish = useMemo(
    () => (existingDishId ? dishes.find((d) => String(d.id) === String(existingDishId)) : null),
    [dishes, existingDishId]
  );

  useEffect(() => {
    const first = sortedCats[0]?.id;
    if (first == null) {
      setCategoryId("");
      return;
    }
    if (existingDishId && selectedDish) {
      setCategoryId(selectedDish.categoryId);
      return;
    }
    setCategoryId((prev) => (sortedCats.some((c) => c.id === prev) ? prev : first));
  }, [sortedCats, existingDishId, selectedDish]);

  const [name, setName] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionKa, setDescriptionKa] = useState("");
  const [descriptionRu, setDescriptionRu] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dishOptionLabel = (d) => {
    const cat = sortedCats.find((c) => c.id === d.categoryId);
    const catEn = cat?.name?.en || cat?.name?.ka || "—";
    const title = d.name?.en || d.name?.ka || "—";
    return `${catEn} · ${title} · ${formatLari(d.price)} ₾`;
  };

  const inputStyle = { width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"13px", fontFamily:"var(--font-body)", borderRadius:"2px", boxSizing:"border-box" };
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"8px", display:"block" };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!isSupabaseConfigured()) {
      setErr("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.");
      return;
    }
    if (!sortedCats.length) {
      setErr("ჯგუფები ცარიელია — Admin → Cuisine → Categories-დან დაამატე კატეგორია.");
      return;
    }
    if (!file) {
      setErr("აირჩიე სურათის ფაილი.");
      return;
    }
    if (existingDishId) {
      if (!dishes.some((d) => String(d.id) === String(existingDishId))) {
        setErr("არასწორი კერძი.");
        return;
      }
    } else {
      if (categoryId === "" || categoryId == null) {
        setErr("აირჩიე კატეგორია.");
        return;
      }
      if (!name.trim()) {
        setErr("Name is required.");
        return;
      }
      const priceNum = parsePriceValue(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setErr("Enter a valid price.");
        return;
      }
    }
    setBusy(true);
    try {
      const imageUrl = await uploadMenuImage(file);
      if (existingDishId) {
        await updateMenuDishImageUrl(existingDishId, imageUrl);
        setMsg("სურათი მიება კერძს Supabase-ში. მენიუ განახლდა.");
        setFile(null);
        await reloadMenuFromSupabase();
        return;
      }
      const priceNum = parsePriceValue(price);
      const catDishes = dishes.filter((d) => d.categoryId === Number(categoryId));
      const maxOrder = catDishes.reduce((m, d) => Math.max(m, d.order ?? 0), 0);
      await insertMenuItem({
        categoryId: Number(categoryId),
        name: name.trim(),
        description: {
          en: descriptionEn.trim(),
          ka: descriptionKa.trim(),
          ru: descriptionRu.trim(),
        },
        price: priceNum,
        imageUrl,
        sortOrder: maxOrder + 1,
      });
      setMsg("Saved to Supabase. Menu refreshed.");
      setName("");
      setDescriptionEn("");
      setDescriptionKa("");
      setDescriptionRu("");
      setPrice("");
      setFile(null);
      await reloadMenuFromSupabase();
    } catch (x) {
      setErr(x?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ padding:"40px", color:"var(--cream)", maxWidth:"720px" }}>
        <PageHeader title="Cloud menu" sub="Supabase" />
        <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.7, marginBottom:"20px" }}>
          Copy <code style={{ color:"var(--gold)" }}>.env.example</code> to <code style={{ color:"var(--gold)" }}>.env.local</code> and set{" "}
          <code style={{ color:"var(--gold)" }}>VITE_SUPABASE_URL</code> and <code style={{ color:"var(--gold)" }}>VITE_SUPABASE_ANON_KEY</code>.
          Run the SQL in <code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>, create bucket <strong style={{ color:"var(--cream)" }}>menu-images</strong> (public), then restart <code style={{ color:"var(--gold)" }}>npm run dev</code>.
        </p>
      </div>
    );
  }

  const updateMode = Boolean(existingDishId);

  return (
    <div style={{ padding:"40px", color:"var(--cream)", maxWidth:"560px" }}>
      <PageHeader
        title="Cloud menu"
        sub={updateMode ? "არსებული კერძი → სურათი → Storage · განახლება Postgres-ში" : "ახალი კერძი · სურათი → Storage · ჩანაწერი Postgres-ში"}
      />
      {err && <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"12px" }}>{err}</div>}
      {msg && <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(16,185,129,0.35)", background:"rgba(16,185,129,0.08)", color:"#86efac", fontSize:"12px" }}>{msg}</div>}
      <form onSubmit={onSubmit} style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
        <div>
          <label style={labelStyle}>არსებული კერძი (სურათის მისაბმელად)</label>
          <select
            value={existingDishId}
            onChange={(e) => {
              const v = e.target.value;
              setExistingDishId(v);
              setErr("");
              setMsg("");
              setFile(null);
              if (v) {
                setName("");
                setDescriptionEn("");
                setDescriptionKa("");
                setDescriptionRu("");
                setPrice("");
              }
            }}
            disabled={menuLoading}
            style={{ ...inputStyle, cursor: menuLoading ? "wait" : "pointer", opacity: menuLoading ? 0.7 : 1 }}
          >
            <option value="" style={{ background:"#132220" }}>
              — ახალი კერძი (ქვემოთ შეავსე სახელი, ფასი) —
            </option>
            {dishOptions.map((d) => (
              <option key={d.id} value={String(d.id)} style={{ background:"#132220" }}>
                {dishOptionLabel(d)}
              </option>
            ))}
          </select>
          {menuLoading && (
            <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>მენიუ იტვირთება…</div>
          )}
          {!menuLoading && dishes.length === 0 && (
            <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>კერძები ჯერ არ ჩანს — შეამოწმე Supabase ან SQL seed.</div>
          )}
        </div>

        {selectedDish && (
          <div
            style={{
              padding:"14px",
              border:"1px solid rgba(61,191,176,0.2)",
              background:"rgba(61,191,176,0.06)",
              borderRadius:"2px",
              display:"flex",
              gap:"14px",
              alignItems:"flex-start",
            }}
          >
            {selectedDish.image ? (
              <img
                src={selectedDish.image}
                alt=""
                width={72}
                height={72}
                loading="lazy"
                decoding="async"
                style={{ width:"72px", height:"72px", objectFit:"cover", borderRadius:"2px", flexShrink:0, border:"1px solid rgba(255,255,255,0.08)" }}
              />
            ) : (
              <div
                style={{
                  width:"72px",
                  height:"72px",
                  flexShrink:0,
                  borderRadius:"2px",
                  border:"1px dashed rgba(255,255,255,0.15)",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  fontSize:"9px",
                  color:"var(--muted)",
                  textAlign:"center",
                  padding:"4px",
                  lineHeight:1.3,
                }}
              >
                სურათი არაა
              </div>
            )}
            <div style={{ minWidth:0, fontSize:"12px", lineHeight:1.5 }}>
              <div style={{ color:"var(--gold)", fontSize:"8px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"6px" }}>არჩეული</div>
              <div style={{ fontFamily:"var(--font-display)", color:"var(--cream)" }}>{selectedDish.name?.en || selectedDish.name?.ka || "—"}</div>
              {(selectedDish.name?.ka || selectedDish.name?.ru) && (
                <div style={{ color:"var(--muted)", marginTop:"4px", fontSize:"11px" }}>
                  {[selectedDish.name?.ka, selectedDish.name?.ru].filter(Boolean).join(" · ")}
                </div>
              )}
              <div style={{ marginTop:"8px", color:"var(--muted)" }}>{formatLari(selectedDish.price)} ₾</div>
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={categoryId === "" || categoryId == null ? "" : String(categoryId)}
            onChange={(e) => {
              const v = e.target.value;
              setCategoryId(v === "" ? "" : Number(v));
            }}
            disabled={updateMode}
            style={{ ...inputStyle, cursor: updateMode ? "not-allowed" : "pointer", opacity: updateMode ? 0.65 : 1 }}
          >
            {sortedCats.length === 0 ? (
              <option value="" style={{ background:"#132220" }}>— ჯგუფი არაა —</option>
            ) : (
              sortedCats.map((c) => (
                <option key={c.id} value={c.id} style={{ background:"#132220" }}>{c.name.en || c.name.ka || `Category ${c.id}`}</option>
              ))
            )}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, opacity: updateMode ? 0.5 : 1 }}
            placeholder="Dish name (English)"
            readOnly={updateMode}
            disabled={updateMode}
          />
        </div>
        {[
          { key: "en", label: "Description (EN)", val: descriptionEn, set: setDescriptionEn, ph: "Short description (English)" },
          { key: "ka", label: "აღწერა (KA)", val: descriptionKa, set: setDescriptionKa, ph: "მოკლე აღწერა ქართულად" },
          { key: "ru", label: "Описание (RU)", val: descriptionRu, set: setDescriptionRu, ph: "Краткое описание по-русски" },
        ].map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <textarea
              value={f.val}
              onChange={(e) => f.set(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-display)", opacity: updateMode ? 0.5 : 1 }}
              placeholder={f.ph}
              readOnly={updateMode}
              disabled={updateMode}
            />
          </div>
        ))}
        <div>
          <label style={labelStyle}>Price (₾)</label>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...inputStyle, opacity: updateMode ? 0.5 : 1 }}
            readOnly={updateMode}
            disabled={updateMode}
          />
        </div>
        <div>
          <label style={labelStyle}>Image file</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize:"12px", color:"var(--muted)" }} />
        </div>
        <button type="submit" disabled={busy || menuLoading} style={{ padding:"14px", background: busy ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase", cursor: busy ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>
          {busy ? "Uploading…" : updateMode ? "განაახლე სურათი Supabase-ში" : "Save to Supabase"}
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════════════════ */
function AdminPanel({ store, onLogout }) {
  const [section, setSection] = useState("dashboard");
  const unread = store.notifications.filter(n=>!n.read).length;

  const navItems = [
    { id:"dashboard", icon:"◈", label:"Overview" },
    { id:"menu",      icon:"◇", label:"Cuisine" },
    { id:"cloud",     icon:"☁", label:"Cloud" },
    { id:"tables",    icon:"◉", label:"Seating" },
    { id:"alerts",    icon:"◌", label:"Alerts", badge:unread },
    { id:"analytics", icon:"◎", label:"Insights" },
  ];

  return (
    <div className="admin-panel-layout">
      <GlobalStyles /><FontLoader />
      <div className="noise" />

      {/* SIDEBAR */}
      <div className="admin-panel-sidebar" style={{ width:"210px", background:"var(--charcoal)", borderRight:"1px solid rgba(61,191,176,0.1)", display:"flex", flexDirection:"column", flexShrink:0, position:"relative", zIndex:10 }}>
        <div style={{ padding:"28px 20px 24px", borderBottom:"1px solid rgba(61,191,176,0.1)" }}>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"26px", fontStyle:"italic", fontWeight:300, color:"var(--cream)" }}>Tiflisi</div>
          <div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"3px", textTransform:"uppercase", marginTop:"4px" }}>Admin Console</div>
        </div>

        <nav style={{ flex:1, padding:"16px 12px" }}>
          {navItems.map(item => (
            <button type="button" key={item.id} onClick={() => setSection(item.id)} className="admin-nav-item" style={{
              width:"100%", display:"flex", alignItems:"center", gap:"10px",
              padding:"11px 12px", border:"none",
              background: section===item.id ? "rgba(61,191,176,0.1)" : "transparent",
              color: section===item.id ? "var(--gold)" : "var(--muted)",
              fontSize:"10px", fontWeight:section===item.id?"600":"400",
              cursor:"pointer", marginBottom:"2px", textAlign:"left",
              letterSpacing:"2px", textTransform:"uppercase", position:"relative",
              borderLeft: section===item.id ? "1px solid var(--gold)" : "1px solid transparent",
              transition:"all 0.2s",
            }}>
              <span style={{ fontSize:"14px" }}>{item.icon}</span> {item.label}
              {item.badge>0 && (
                <span style={{ marginLeft:"auto", background:"#7f1d1d", color:"#fca5a5", fontSize:"9px", fontWeight:"700", padding:"1px 6px", minWidth:"16px", textAlign:"center" }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:"16px 12px", borderTop:"1px solid rgba(61,191,176,0.1)" }}>
          <button type="button" onClick={onLogout} style={{ width:"100%", padding:"10px 12px", background:"transparent", border:"1px solid rgba(239,68,68,0.2)", color:"rgba(239,68,68,0.6)", fontSize:"9px", letterSpacing:"2px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)", transition:"all 0.2s", touchAction:"manipulation", WebkitTapHighlightColor:"transparent" }}>
            EXIT SESSION
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="admin-panel-main" style={{ flex:1, minWidth:0, overflow:"auto", WebkitOverflowScrolling:"touch", position:"relative", zIndex:1 }}>
        {section==="dashboard"  && <AdminDash store={store} />}
        {section==="menu"       && <AdminMenu store={store} />}
        {section==="cloud"      && <AdminCloudMenu store={store} />}
        {section==="tables"     && <AdminTables store={store} />}
        {section==="alerts"     && <AdminAlerts store={store} />}
        {section==="analytics"  && <AdminAnalytics store={store} />}
      </div>
    </div>
  );
}

/* ─── Shared Admin Components ─────────────────────────────────────────── */
function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"32px" }}>
      <div>
        <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"6px" }}>{sub}</div>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:"36px", fontWeight:300, fontStyle:"italic", color:"var(--cream)", margin:0, letterSpacing:"-0.5px" }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}

function Stat({ icon, label, value, trend, color="var(--gold)" }) {
  return (
    <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px 20px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, right:0, width:"60px", height:"60px", background:`radial-gradient(circle at 80% 20%, ${color}15, transparent 70%)` }} />
      <div style={{ fontSize:"22px", marginBottom:"12px" }}>{icon}</div>
      <div style={{ fontFamily:"var(--font-display)", fontSize:"36px", fontWeight:300, color, letterSpacing:"-1px" }}>{value}</div>
      <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"2px", textTransform:"uppercase", marginTop:"4px" }}>{label}</div>
      {trend && <div style={{ fontSize:"9px", color:"#10b981", marginTop:"6px" }}>{trend}</div>}
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────────────────── */
function AdminDash({ store }) {
  const active = store.tables.filter(t=>t.active).length;
  const topDish = store.dishes.reduce((a,b) => (store.analytics.views[a.id]||0) > (store.analytics.views[b.id]||0) ? a : b, store.dishes[0]);
  const totalViews = Object.values(store.analytics.views).reduce((a,b)=>a+b,0);

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Overview" sub="Tiflisi · Live Dashboard" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"32px" }}>
        <Stat icon="◈" label="Scans Today" value={store.analytics.scans} color="var(--gold)" />
        <Stat icon="◉" label="Active Tables" value={active} color="#10b981" />
        <Stat icon="◎" label="Dish Views" value={totalViews} color="#8b5cf6" />
        <Stat icon="◇" label="Total Dishes" value={store.dishes.length} color="var(--amber)" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        {/* Recent Alerts */}
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Recent Alerts</div>
          {store.notifications.slice(0,5).map(n => (
            <div key={n.id} style={{ display:"flex", gap:"12px", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width:"28px", height:"28px", background: n.type==="waiter"?"rgba(61,191,176,0.1)":"rgba(139,92,246,0.1)", border:`1px solid ${n.type==="waiter"?"rgba(61,191,176,0.3)":"rgba(139,92,246,0.3)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", flexShrink:0 }}>
                {n.type==="waiter"?"◈":"◇"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"12px", color:"var(--cream)", fontWeight:500 }}>{n.tableName}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", marginTop:"2px", letterSpacing:"0.5px" }}>{n.message} · {n.time?.toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
          {store.notifications.length===0 && <div style={{ fontSize:"11px", color:"var(--subtle)", fontStyle:"italic", fontFamily:"var(--font-display)" }}>No alerts at this time</div>}
        </div>

        {/* Tables */}
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Seating Status</div>
          {store.tables.map(tb => (
            <div key={tb.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", marginBottom:"6px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize:"12px", color:"var(--cream)" }}>{tb.name}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"1px" }}>{tb.zone}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background: tb.active?"#10b981":"var(--subtle)", animation: tb.active?"pulse 2s infinite":"none" }} />
                <span style={{ fontSize:"9px", color: tb.active?"#10b981":"var(--subtle)", letterSpacing:"1px" }}>{tb.active?"ACTIVE":"OFFLINE"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Menu Management ─────────────────────────────────────────────────── */
function AdminMenu({ store }) {
  const { categories, setCategories, dishes, setDishes, menuError, clearMenuError } = store;
  const syncDishesToSupabase = isSupabaseConfigured();
  const [adminTab, setAdminTab] = useState("dishes");
  const [filter, setFilter] = useState(null);
  const [modal, setModal] = useState(null);
  const [dishCloudErr, setDishCloudErr] = useState(null);
  const [dishSaving, setDishSaving] = useState(false);
  const [catModal, setCatModal] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const [categoryError, setCategoryError] = useState(null);
  const [catSaving, setCatSaving] = useState(false);

  const sortedCats = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);

  const emptyDish = useCallback(() => ({
    id: null,
    categoryId: sortedCats[0]?.id,
    name: { en: "", ka: "", ru: "" },
    description: { en: "", ka: "", ru: "" },
    price: "",
    image: "",
    ingredients: [],
    badges: [],
    available: true,
    featured: false,
  }), [sortedCats]);

  const [form, setForm] = useState(() => ({
    id: null,
    categoryId: undefined,
    name: { en: "", ka: "", ru: "" },
    description: { en: "", ka: "", ru: "" },
    price: "",
    image: "",
    ingredients: [],
    badges: [],
    available: true,
    featured: false,
  }));

  const emptyCategory = useCallback(() => {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.order ?? 0), 0);
    return { id: null, name: { en: "", ka: "", ru: "" }, icon: "◆", order: maxOrder + 1 };
  }, [categories]);

  const openNew = () => { setDishCloudErr(null); setForm(emptyDish()); setModal("new"); };
  const openEdit = (d) => { setDishCloudErr(null); setForm({ ...d, ingredients: [...d.ingredients] }); setModal(d.id); };

  const save = async () => {
    setDishCloudErr(null);
    if (!sortedCats.length) {
      setDishCloudErr("ჯგუფი არ გაქვს — ჯერ დაამატე კატეგორია (Categories).");
      return;
    }
    if (!Number.isFinite(Number(form.categoryId))) {
      setDishCloudErr("აირჩიე კატეგორია.");
      return;
    }
    const priceNum = parsePriceValue(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setDishCloudErr("Enter a valid price.");
      return;
    }
    let payload = { ...form, price: priceNum, categoryId: Number(form.categoryId) };
    if (modal === "new") {
      const maxOrder = dishes.filter((d) => d.categoryId === payload.categoryId).reduce((m, d) => Math.max(m, d.order ?? 0), 0);
      payload = { ...payload, order: maxOrder + 1 };
    } else {
      const prev = dishes.find((d) => String(d.id) === String(modal));
      if (prev && prev.categoryId !== payload.categoryId) {
        const maxOrder = dishes
          .filter((d) => d.categoryId === payload.categoryId && String(d.id) !== String(modal))
          .reduce((m, d) => Math.max(m, d.order ?? 0), 0);
        payload = { ...payload, order: maxOrder + 1 };
      }
    }

    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        if (modal === "new") {
          const created = await insertFullMenuDish(payload);
          setDishes((p) => [...p, created]);
          setFilter(null);
        } else {
          const updated = await updateFullMenuDish(modal, payload);
          setDishes((p) => p.map((d) => (String(d.id) === String(modal) ? updated : d)));
        }
        clearMenuError();
        setModal(null);
      } catch (e) {
        setDishCloudErr(e?.message || "Could not save to Supabase");
      } finally {
        setDishSaving(false);
      }
      return;
    }

    if (modal === "new") {
      setDishes((p) => [...p, { ...payload, id: Date.now() }]);
      setFilter(null);
    } else {
      setDishes((p) => p.map((d) => (String(d.id) === String(modal) ? { ...payload, id: modal } : d)));
    }
    setModal(null);
  };

  const del = async (id) => {
    setDishCloudErr(null);
    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        await deleteMenuDishById(id);
        setDishes((p) => p.filter((d) => String(d.id) !== String(id)));
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not delete");
      } finally {
        setDishSaving(false);
      }
      return;
    }
    setDishes((p) => p.filter((d) => String(d.id) !== String(id)));
  };

  const toggle = async (id) => {
    setDishCloudErr(null);
    const row = dishes.find((d) => String(d.id) === String(id));
    if (!row) return;
    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        await setMenuDishAvailable(id, !row.available);
        setDishes((p) => p.map((d) => (String(d.id) === String(id) ? { ...d, available: !d.available } : d)));
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not update availability");
      } finally {
        setDishSaving(false);
      }
      return;
    }
    setDishes((p) => p.map((d) => (String(d.id) === String(id) ? { ...d, available: !d.available } : d)));
  };

  const openNewCategory = () => { setCategoryError(null); setCatForm(emptyCategory()); setCatModal("new"); };
  const openEditCategory = c => { setCategoryError(null); setCatForm({ ...c, name: { ...c.name } }); setCatModal(c.id); };
  const saveCategory = async () => {
    setCategoryError(null);
    const hasName = [catForm.name.en, catForm.name.ka, catForm.name.ru].some(s => String(s || "").trim());
    if (!hasName) { setCategoryError("Add at least one name (EN, KA, or RU)."); return; }
    const orderNum = Number(catForm.order);
    const payload = { ...catForm, order: Number.isFinite(orderNum) ? orderNum : 0 };

    if (syncDishesToSupabase) {
      setCatSaving(true);
      try {
        if (catModal === "new") {
          const nid = categories.length ? Math.max(...categories.map((c) => c.id)) + 1 : 1;
          const created = await insertMenuCategory({ ...payload, id: nid });
          setCategories((p) => [...p, created]);
        } else {
          const updated = await updateMenuCategory(catModal, { ...payload, id: catModal });
          setCategories((p) => p.map((c) => (c.id === catModal ? updated : c)));
        }
        clearMenuError();
        setCatModal(null);
        setCatForm(null);
      } catch (e) {
        setCategoryError(e?.message || "Could not save category to Supabase");
      } finally {
        setCatSaving(false);
      }
      return;
    }

    if (catModal === "new") {
      const nid = categories.length ? Math.max(...categories.map(c => c.id)) + 1 : 1;
      setCategories(p => [...p, { ...payload, id: nid }]);
    } else {
      setCategories(p => p.map(c => c.id === catModal ? { ...payload, id: catModal } : c));
    }
    setCatModal(null);
    setCatForm(null);
  };
  const delCategory = async (id) => {
    setCategoryError(null);
    if (dishes.some(d => d.categoryId === id)) {
      setCategoryError("Reassign or remove dishes in this category before deleting.");
      return;
    }
    if (syncDishesToSupabase) {
      setCatSaving(true);
      try {
        await deleteMenuCategory(id);
        setCategories((p) => p.filter((c) => c.id !== id));
        if (filter === id) setFilter(null);
        clearMenuError();
      } catch (e) {
        setCategoryError(e?.message || "Could not delete category");
      } finally {
        setCatSaving(false);
      }
      return;
    }
    setCategories(p => p.filter(c => c.id !== id));
    if (filter === id) setFilter(null);
  };

  /** Swap position in sorted list, then renumber order 1…n so guest menu & nav stay consistent. */
  const moveCategory = useCallback(
    async (id, delta) => {
      setCategoryError(null);
      let orderById = null;
      setCategories((prev) => {
        const sorted = [...prev].sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.id - b.id);
        const idx = sorted.findIndex((x) => x.id === id);
        const j = idx + delta;
        if (idx < 0 || j < 0 || j >= sorted.length) return prev;
        const copy = [...sorted];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        const map = {};
        copy.forEach((cat, i) => {
          map[cat.id] = i + 1;
        });
        orderById = map;
        return prev.map((c) => ({ ...c, order: map[c.id] ?? c.order }));
      });
      if (!syncDishesToSupabase || !orderById) return;
      try {
        await updateMenuCategorySortOrders(orderById);
        clearMenuError();
      } catch (e) {
        setCategoryError(e?.message || "Could not save category order");
      }
    },
    [setCategories, syncDishesToSupabase, clearMenuError]
  );

  const dishesByCatSorted = useMemo(() => {
    const m = new Map();
    for (const d of dishes) {
      const k = d.categoryId;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id)));
    }
    return m;
  }, [dishes]);

  const shownSorted = useMemo(() => {
    const base = filter != null ? dishes.filter((d) => d.categoryId === filter) : [...dishes];
    const byOrder = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id));
    if (filter != null) return base.sort(byOrder);
    const catIdx = new Map(sortedCats.map((c, i) => [c.id, i]));
    return base.sort((a, b) => {
      const ia = catIdx.has(a.categoryId) ? catIdx.get(a.categoryId) : 999;
      const ib = catIdx.has(b.categoryId) ? catIdx.get(b.categoryId) : 999;
      if (ia !== ib) return ia - ib;
      return byOrder(a, b);
    });
  }, [dishes, filter, sortedCats]);

  const moveDish = useCallback(
    async (dishId, delta) => {
      setDishCloudErr(null);
      const row = dishes.find((d) => String(d.id) === String(dishId));
      if (!row) return;
      const catId = row.categoryId;
      let orderById = null;
      setDishes((prev) => {
        const inCat = prev.filter((d) => d.categoryId === catId);
        const sorted = [...inCat].sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id)));
        const idx = sorted.findIndex((x) => String(x.id) === String(dishId));
        const j = idx + delta;
        if (idx < 0 || j < 0 || j >= sorted.length) return prev;
        const copy = [...sorted];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        const map = {};
        copy.forEach((d, i) => {
          map[d.id] = i + 1;
        });
        orderById = map;
        return prev.map((d) => (d.categoryId !== catId ? d : { ...d, order: map[d.id] ?? d.order ?? 0 }));
      });
      if (!syncDishesToSupabase || !orderById) return;
      setDishSaving(true);
      try {
        await updateMenuDishSortOrders(orderById);
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not save dish order");
      } finally {
        setDishSaving(false);
      }
    },
    [dishes, syncDishesToSupabase, clearMenuError]
  );

  const tabBtn = (active) => ({
    padding: "8px 18px",
    border: `1px solid ${active ? "var(--gold)" : "rgba(61,191,176,0.15)"}`,
    background: active ? "rgba(61,191,176,0.12)" : "transparent",
    color: active ? "var(--gold)" : "var(--muted)",
    fontSize: "9px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    borderRadius: "2px",
  });

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Cuisine" sub="Menu Management"
        action={
          adminTab === "dishes" ? (
            <button onClick={openNew} style={{ padding:"10px 22px", background:"linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>+ NEW DISH</button>
          ) : (
            <button onClick={openNewCategory} style={{ padding:"10px 22px", background:"linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>+ NEW CATEGORY</button>
          )
        } />

      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        <button type="button" onClick={() => { setCategoryError(null); setAdminTab("dishes"); }} style={tabBtn(adminTab === "dishes")}>Dishes</button>
        <button type="button" onClick={() => { setCategoryError(null); setAdminTab("categories"); }} style={tabBtn(adminTab === "categories")}>Categories</button>
      </div>

      {adminTab === "categories" && (
        <>
          {categoryError && (
            <div style={{ marginBottom:"16px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", letterSpacing:"0.3px" }}>{categoryError}</div>
          )}
          {syncDishesToSupabase && (
            <div style={{ marginBottom:"16px", padding:"10px 14px", border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.06)", color:"#86efac", fontSize:"10px", letterSpacing:"0.3px", lineHeight:1.5 }}>
              კატეგორიები იტვირთება და ინახება Supabase-ში — ცხრილი <code style={{ color:"var(--gold)" }}>public.menu_categories</code> (SQL: <code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>).
            </div>
          )}
          <div style={{ fontSize:"10px", color:"var(--muted)", marginBottom:"12px", letterSpacing:"0.3px", lineHeight:1.5 }}>
            ↑ / ↓ — ჯგუფების თანმიმდევრობა სტუმრის მენიუში; ყოველი გადაადგილების შემდეგ ნომრები (order) აივსება 1-დან ბოლომდე.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:"12px", marginBottom:"24px" }}>
            {sortedCats.map((c, idx) => (
              <div key={c.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", padding:"20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
                  <div style={{ fontSize:"22px", color:"var(--gold)", opacity:0.85 }}>{c.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--cream)" }}>{c.name.en || c.name.ka || c.name.ru || "—"}</div>
                    <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"6px", lineHeight:1.5 }}>
                      <span style={{ color:"var(--subtle)" }}>KA</span> {c.name.ka || "—"}<br />
                      <span style={{ color:"var(--subtle)" }}>RU</span> {c.name.ru || "—"}
                    </div>
                    <div style={{ fontSize:"9px", color:"var(--subtle)", marginTop:"8px", letterSpacing:"1px" }}>ORDER · {c.order ?? 0} · ID {c.id}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"6px", marginTop:"16px", flexWrap:"wrap" }}>
                  <button type="button" aria-label="Move up" disabled={idx === 0 || catSaving} onClick={() => moveCategory(c.id, -1)} style={{
                    padding:"8px 12px", background: idx === 0 || catSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${idx === 0 || catSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: idx === 0 || catSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: idx === 0 || catSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: idx === 0 || catSaving ? 0.45 : 1,
                  }}>↑</button>
                  <button type="button" aria-label="Move down" disabled={idx === sortedCats.length - 1 || catSaving} onClick={() => moveCategory(c.id, 1)} style={{
                    padding:"8px 12px", background: idx === sortedCats.length - 1 || catSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${idx === sortedCats.length - 1 || catSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: idx === sortedCats.length - 1 || catSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: idx === sortedCats.length - 1 || catSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: idx === sortedCats.length - 1 || catSaving ? 0.45 : 1,
                  }}>↓</button>
                  <button type="button" disabled={catSaving} onClick={() => openEditCategory(c)} style={{ flex:1, minWidth:"100px", padding:"8px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"1.5px", cursor: catSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: catSaving ? 0.6 : 1 }}>EDIT</button>
                  <button type="button" disabled={catSaving} onClick={() => delCategory(c.id)} style={{ padding:"8px 12px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.75)", fontSize:"11px", cursor: catSaving ? "wait" : "pointer", opacity: catSaving ? 0.6 : 1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {adminTab === "dishes" && (
      <>
      {syncDishesToSupabase && menuError && (
        <div style={{ marginBottom:"20px", padding:"12px 14px", border:"1px solid rgba(234,179,8,0.35)", background:"rgba(234,179,8,0.08)", color:"#fde68a", fontSize:"11px", lineHeight:1.55, letterSpacing:"0.2px" }}>
          Supabase-მდე მენიუ ვერ ჩაიტვირთა: <strong style={{ color:"#fef3c7" }}>{menuError}</strong> — შეამოწმე ცხრილი <code style={{ color:"var(--gold)" }}>menu</code>, RLS და <code style={{ color:"var(--gold)" }}>.env.local</code>. Cuisine-ის ცვლილებები მაინც ინახება მხოლოდ Supabase-ში (ლოკალური სია აღარ გამოიყენება).
        </div>
      )}
      {syncDishesToSupabase && !menuError && (
        <div style={{ marginBottom:"16px", padding:"10px 14px", border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.06)", color:"#86efac", fontSize:"10px", letterSpacing:"0.3px" }}>
          მენიუ იტვირთება Supabase-იდან — კერძები: <code style={{ color:"var(--gold)" }}>public.menu</code>; კატეგორიები (ჩანართი Categories): <code style={{ color:"var(--gold)" }}>public.menu_categories</code>.
        </div>
      )}
      <div style={{ display:"flex", gap:"6px", marginBottom:"24px", flexWrap:"wrap" }}>
        <CatBtn active={!filter} onClick={()=>setFilter(null)} label="All" />
        {sortedCats.map(c=><CatBtn key={c.id} active={filter===c.id} onClick={()=>setFilter(c.id)} label={c.name.en} icon={c.icon} />)}
      </div>

      <div style={{ fontSize:"10px", color:"var(--muted)", marginBottom:"12px", letterSpacing:"0.3px", lineHeight:1.5 }}>
        ↑ / ↓ — კერძის თანმიმდევრობა იმავე კატეგორიაში (სტუმრის მენიუ). Supabase: გაუშვი SQL ცხრილზე <code style={{ color:"var(--gold)" }}>sort_order</code> თუ ბაზა ძველია (<code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>).
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap:"12px" }}>
        {shownSorted.map(dish => {
          const cat = categories.find(c=>c.id===dish.categoryId);
          const sibs = dishesByCatSorted.get(dish.categoryId) || [];
          const di = sibs.findIndex((x) => String(x.id) === String(dish.id));
          return (
            <div key={dish.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", overflow:"hidden" }}>
              <div style={{ position:"relative", height:"160px" }}>
                <img
                  src={dish.image}
                  alt=""
                  width={400}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  style={{ width:"100%", height:"160px", objectFit:"cover", display:"block", filter:dish.available?"none":"grayscale(1) opacity(0.5)" }}
                />
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(7,6,8,0.7) 0%, transparent 60%)" }} />
                <div style={{ position:"absolute", bottom:"10px", left:"12px", right:"12px", display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:"18px", fontStyle:"italic", color:"#fff" }}>{dish.name.en}</div>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", color:"var(--gold-light)" }}>₾{formatLari(dish.price)}</div>
                </div>
                <div style={{ position:"absolute", top:"8px", right:"8px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
                  {dish.badges.map((b, bi) => <span key={`${dish.id}-ab-${bi}-${b}`} style={{ background:BADGE_CFG[b]?.bg||"#333", color:BADGE_CFG[b]?.color||"#fff", fontSize:"7px", padding:"2px 6px", fontWeight:"700", letterSpacing:"1px" }}>{b}</span>)}
                </div>
              </div>
              <div style={{ padding:"14px 14px 10px" }}>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"1px", marginBottom:"10px" }}>{cat?.icon} {cat?.name.en}</div>
                <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}>
                  <button type="button" aria-label="Move dish up" disabled={di <= 0 || dishSaving} onClick={() => moveDish(dish.id, -1)} style={{
                    padding:"8px 12px", background: di <= 0 || dishSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${di <= 0 || dishSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: di <= 0 || dishSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: di <= 0 || dishSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: di <= 0 || dishSaving ? 0.45 : 1,
                  }}>↑</button>
                  <button type="button" aria-label="Move dish down" disabled={di < 0 || di >= sibs.length - 1 || dishSaving} onClick={() => moveDish(dish.id, 1)} style={{
                    padding:"8px 12px", background: di < 0 || di >= sibs.length - 1 || dishSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${di < 0 || di >= sibs.length - 1 || dishSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: di < 0 || di >= sibs.length - 1 || dishSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: di < 0 || di >= sibs.length - 1 || dishSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: di < 0 || di >= sibs.length - 1 || dishSaving ? 0.45 : 1,
                  }}>↓</button>
                </div>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button type="button" disabled={dishSaving} onClick={()=>openEdit(dish)} style={{ flex:1, padding:"7px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"1.5px", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: dishSaving ? 0.6 : 1 }}>EDIT</button>
                  <button type="button" disabled={dishSaving} onClick={()=>toggle(dish.id)} style={{ flex:1, padding:"7px", background:dish.available?"rgba(16,185,129,0.06)":"rgba(239,68,68,0.06)", border:`1px solid ${dish.available?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)"}`, color:dish.available?"#10b981":"#ef4444", fontSize:"9px", letterSpacing:"1.5px", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: dishSaving ? 0.6 : 1 }}>
                    {dish.available?"ACTIVE":"OFF"}
                  </button>
                  <button type="button" disabled={dishSaving} onClick={()=>del(dish.id)} style={{ padding:"7px 10px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.7)", fontSize:"11px", cursor: dishSaving ? "wait" : "pointer", opacity: dishSaving ? 0.6 : 1 }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {catModal !== null && catForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(8px)", padding:"20px" }}>
          <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.2)", padding:"36px", width:"100%", maxWidth:"520px", maxHeight:"85vh", overflowY:"auto", animation:"slideIn 0.3s ease" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"28px", fontStyle:"italic", color:"var(--cream)", marginBottom:"24px" }}>
              {catModal === "new" ? "New Category" : "Edit Category"}
            </div>
            {categoryError && <div style={{ marginBottom:"14px", fontSize:"11px", color:"#fca5a5" }}>{categoryError}</div>}
            <CategoryFormAdmin form={catForm} setForm={setCatForm} />
            <div style={{ display:"flex", gap:"10px", marginTop:"24px" }}>
              <button type="button" disabled={catSaving} onClick={() => saveCategory()} style={{ flex:1, padding:"13px", background: catSaving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: catSaving ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>SAVE</button>
              <button type="button" disabled={catSaving} onClick={() => { setCatModal(null); setCatForm(null); setCategoryError(null); }} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"var(--muted)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: catSaving ? "not-allowed" : "pointer", fontFamily:"var(--font-body)" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {modal!==null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(8px)", padding:"20px" }}>
          <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.2)", padding:"36px", width:"100%", maxWidth:"560px", maxHeight:"85vh", overflowY:"auto", animation:"slideIn 0.3s ease" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"28px", fontStyle:"italic", color:"var(--cream)", marginBottom:"28px" }}>
              {modal==="new"?"New Dish":"Edit Dish"}
            </div>
            {dishCloudErr && (
              <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px" }}>{dishCloudErr}</div>
            )}
            <DishFormAdmin form={form} setForm={setForm} categories={sortedCats} />
            <div style={{ display:"flex", gap:"10px", marginTop:"24px" }}>
              <button type="button" disabled={dishSaving} onClick={() => save()} style={{ flex:1, padding:"13px", background: dishSaving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>SAVE</button>
              <button type="button" disabled={dishSaving} onClick={() => setModal(null)} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"var(--muted)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: dishSaving ? "not-allowed" : "pointer", fontFamily:"var(--font-body)" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryFormAdmin({ form, setForm }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setL = (f, l, v) => setForm(p => ({ ...p, [f]: { ...p[f], [l]: v } }));
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"6px", display:"block" };
  const inputStyle = { width:"100%", padding:"10px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", boxSizing:"border-box", letterSpacing:"0.5px" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      <div>
        <label style={labelStyle}>Icon (symbol)</label>
        <input value={form.icon ?? ""} onChange={e => set("icon", e.target.value.slice(0, 2))} style={{ ...inputStyle, maxWidth:"100px", fontFamily:"var(--font-display)", fontSize:"20px" }} />
      </div>
      <div>
        <label style={labelStyle}>Sort order</label>
        <input type="number" value={form.order === "" || form.order === undefined ? "" : form.order} onChange={e => set("order", e.target.value === "" ? "" : Number(e.target.value))} style={{ ...inputStyle, fontFamily:"var(--font-body)", fontSize:"13px" }} />
      </div>
      {["en","ka","ru"].map(l => (
        <div key={l}>
          <label style={labelStyle}>Name ({l.toUpperCase()})</label>
          <input value={form.name[l] ?? ""} onChange={e => setL("name", l, e.target.value)} style={inputStyle} />
        </div>
      ))}
    </div>
  );
}

function DishFormAdmin({ form, setForm, categories }) {
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const setL = (f,l,v) => setForm(p=>({...p,[f]:{...p[f],[l]:v}}));
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"6px", display:"block" };
  const inputStyle = { width:"100%", padding:"10px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", boxSizing:"border-box", letterSpacing:"0.5px" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      <div>
        <label style={labelStyle}>Category</label>
        <select
          value={form.categoryId === undefined || form.categoryId === null ? "" : String(form.categoryId)}
          onChange={(e) => {
            const v = e.target.value;
            set("categoryId", v === "" ? undefined : Number(v));
          }}
          style={{ ...inputStyle, fontFamily: "var(--font-body)", fontSize: "12px" }}
        >
          {categories.length === 0 ? (
            <option value="" style={{ background: "var(--charcoal)" }}>— ჯგუფი არაა —</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id} style={{ background: "var(--charcoal)" }}>{c.name.en}</option>
            ))
          )}
        </select>
      </div>
      {["en","ka","ru"].map(l=>(
        <div key={l}>
          <label style={labelStyle}>Name ({l.toUpperCase()})</label>
          <input value={form.name[l]} onChange={e=>setL("name",l,e.target.value)} style={inputStyle} />
        </div>
      ))}
      {["en", "ka", "ru"].map((l) => (
        <div key={l}>
          <label style={labelStyle}>
            {l === "en" ? "Description (EN)" : l === "ka" ? "აღწერა (KA)" : "Описание (RU)"}
          </label>
          <textarea
            value={form.description[l] ?? ""}
            onChange={(e) => setL("description", l, e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        <div><label style={labelStyle}>Price (₾)</label><input type="number" min={0} step="any" inputMode="decimal" value={form.price === "" || form.price == null ? "" : form.price} onChange={(e) => set("price", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Image URL</label><input value={form.image} onChange={e=>set("image",e.target.value)} style={inputStyle} /></div>
      </div>
      <div>
        <label style={labelStyle}>Distinctions</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"6px" }}>
          {Object.keys(BADGE_CFG).map(b=>(
            <button key={b} onClick={()=>set("badges",form.badges.includes(b)?form.badges.filter(x=>x!==b):[...form.badges,b])} style={{ padding:"5px 12px", border:"1px solid", borderColor:form.badges.includes(b)?"var(--gold)":"rgba(61,191,176,0.15)", background:form.badges.includes(b)?"rgba(61,191,176,0.12)":"transparent", color:form.badges.includes(b)?"var(--gold)":"var(--muted)", fontSize:"9px", letterSpacing:"1px", cursor:"pointer", fontFamily:"var(--font-body)" }}>{b}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:"20px" }}>
        {[["available","✦ Available"],["featured","◈ Featured"]].map(([k,l])=>(
          <label key={k} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"11px", color:"var(--muted)" }}>
            <input type="checkbox" checked={form[k]} onChange={e=>set(k,e.target.checked)} /> {l}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Full URL to guest menu with table (for QR scanners). */
function menuUrlForTable(tableId) {
  const base = import.meta.env.BASE_URL || "/";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try {
    return new URL(`?table=${encodeURIComponent(String(tableId))}`, origin + base).href;
  } catch {
    const b = String(base).replace(/\/?$/, "/");
    return `${origin}${b}?table=${encodeURIComponent(String(tableId))}`;
  }
}

function TableQrImage({ tableId, tableName, zone }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const url = useMemo(() => menuUrlForTable(tableId), [tableId]);

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#0f1818", light: "#d4f7f2" },
      errorCorrectionLevel: "M",
    })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div style={{ textAlign:"center", padding:"16px", background:"linear-gradient(160deg, #d4f7f2, #f5ddd6)", marginBottom:"14px" }}>
      {dataUrl && (
        <img
          src={dataUrl}
          alt={`QR: ${tableName}`}
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          style={{ width:"160px", height:"160px", display:"block", margin:"0 auto", imageRendering:"pixelated" }}
        />
      )}
      {!dataUrl && !failed && (
        <div style={{ fontSize:"10px", color:"#333", padding:"48px 8px" }}>…</div>
      )}
      {failed && <div style={{ fontSize:"10px", color:"#991b1b" }}>QR failed</div>}
      <div style={{ marginTop:"10px", fontSize:"8px", color:"#444", letterSpacing:"0.3px", fontFamily:"var(--font-body)", wordBreak:"break-all", lineHeight:1.4 }}>
        {url}
      </div>
      <div style={{ marginTop:"6px", fontSize:"9px", color:"#555" }}>{tableName} · {zone}</div>
    </div>
  );
}

/* ─── Tables ──────────────────────────────────────────────────────────── */
function AdminTables({ store }) {
  const { tables, tablesLoading, tablesError, addTableRow, toggleTableRow, removeTableRow, reloadSeatingFromSupabase } = store;
  const [name, setName] = useState(""); const [zone, setZone] = useState("Grand Hall");
  const [qr, setQr] = useState(null);
  const [seatErr, setSeatErr] = useState(null);

  const add = async () => {
    if (!name.trim()) return;
    setSeatErr(null);
    try {
      await addTableRow(name.trim(), zone);
      setName("");
    } catch (e) {
      setSeatErr(e?.message || "Save failed");
    }
  };
  const toggle = async (id) => {
    setSeatErr(null);
    try {
      await toggleTableRow(id);
    } catch (e) {
      setSeatErr(e?.message || "Update failed");
    }
  };
  const del = async (id) => {
    setSeatErr(null);
    try {
      await removeTableRow(id);
    } catch (e) {
      setSeatErr(e?.message || "Delete failed");
    }
  };

  const inputStyle = { padding:"11px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader
        title="Seating"
        sub={isSupabaseConfigured() ? "Table Management · Supabase (all devices)" : "Table Management · this browser only"}
        action={
          isSupabaseConfigured() ? (
            <button
              type="button"
              onClick={() => {
                setSeatErr(null);
                reloadSeatingFromSupabase().catch((e) => setSeatErr(e?.message || "Reload failed"));
              }}
              style={{ padding:"9px 18px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.25)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}
            >
              RELOAD FROM CLOUD
            </button>
          ) : null
        }
      />

      {(tablesError || seatErr) && (
        <div style={{ marginBottom:"16px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", lineHeight:1.5 }}>
          {seatErr || tablesError}
        </div>
      )}
      {tablesLoading && tables.length === 0 && (
        <div style={{ marginBottom:"16px", fontSize:"12px", color:"var(--muted)" }}>Loading tables…</div>
      )}

      <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.15)", padding:"28px", marginBottom:"28px" }}>
        <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Add Table</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:"20px", alignItems:"end" }}>
          <div><div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"2px", marginBottom:"6px" }}>TABLE NAME</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Salon Privé" style={inputStyle} /></div>
          <div>
            <div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"2px", marginBottom:"6px" }}>ZONE</div>
            <select value={zone} onChange={e=>setZone(e.target.value)} style={{...inputStyle,fontFamily:"var(--font-body)",fontSize:"12px"}}>
              {["Grand Hall","VIP","Terrace","Bar","Private"].map(z=><option key={z} style={{background:"var(--charcoal)"}}>{z}</option>)}
            </select>
          </div>
          <button type="button" onClick={add} disabled={tablesLoading} style={{ padding:"11px 24px", background:"rgba(61,191,176,0.12)", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", textTransform:"uppercase", cursor: tablesLoading ? "wait" : "pointer", fontFamily:"var(--font-body)", whiteSpace:"nowrap", opacity: tablesLoading ? 0.6 : 1 }}>ADD</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"12px" }}>
        {tables.map(tb => (
          <div key={tb.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", padding:"22px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"16px" }}>
              <div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--cream)" }}>{tb.name}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"2px", marginTop:"2px" }}>{tb.zone}</div>
                <div style={{ fontSize:"8px", color:"var(--subtle)", marginTop:"6px", letterSpacing:"1px", wordBreak:"break-all" }}>{menuUrlForTable(tb.id)}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:tb.active?"#10b981":"var(--subtle)", animation:tb.active?"pulse 2s infinite":"none" }} />
                <span style={{ fontSize:"8px", color:tb.active?"#10b981":"var(--subtle)", letterSpacing:"1.5px" }}>{tb.active?"LIVE":"OFF"}</span>
              </div>
            </div>

            {qr===tb.id && <TableQrImage tableId={tb.id} tableName={tb.name} zone={tb.zone} />}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:"6px" }}>
              <button onClick={()=>setQr(qr===tb.id?null:tb.id)} style={{ padding:"8px", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", color:"#a78bfa", fontSize:"8px", letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>
                {qr===tb.id?"HIDE":"QR"}
              </button>
              <button onClick={()=>toggle(tb.id)} style={{ padding:"8px", background:tb.active?"rgba(239,68,68,0.06)":"rgba(16,185,129,0.06)", border:`1px solid ${tb.active?"rgba(239,68,68,0.2)":"rgba(16,185,129,0.2)"}`, color:tb.active?"#ef4444":"#10b981", fontSize:"8px", letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>
                {tb.active?"PAUSE":"START"}
              </button>
              <button onClick={()=>del(tb.id)} style={{ padding:"8px 10px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.1)", color:"rgba(239,68,68,0.5)", cursor:"pointer", fontSize:"11px" }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Alerts ──────────────────────────────────────────────────────────── */
function AdminAlerts({ store }) {
  const { notifications, setNotifications } = store;
  const unread = notifications.filter(n=>!n.read).length;

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Alerts" sub={`${unread} Unread Notifications`}
        action={
          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={()=>setNotifications(p=>p.map(n=>({...n,read:true})))} style={{ padding:"9px 18px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}>MARK READ</button>
            <button onClick={()=>setNotifications([])} style={{ padding:"9px 18px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.7)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}>CLEAR ALL</button>
          </div>
        } />

      {notifications.length===0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", fontFamily:"var(--font-display)", fontSize:"22px", fontStyle:"italic", color:"var(--subtle)" }}>No alerts at this time</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {notifications.map(n => (
            <div key={n.id} onClick={()=>setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))} style={{
              display:"flex", gap:"16px", alignItems:"center",
              padding:"18px 20px", background: n.read?"rgba(255,255,255,0.015)":"rgba(61,191,176,0.04)",
              border:`1px solid ${n.read?"rgba(255,255,255,0.05)":"rgba(61,191,176,0.15)"}`,
              borderLeft:`3px solid ${n.type==="waiter"?"var(--gold)":"#8b5cf6"}`,
              cursor:"pointer", transition:"all 0.2s",
            }}>
              <div style={{ width:"36px", height:"36px", background: n.type==="waiter"?"rgba(61,191,176,0.1)":"rgba(139,92,246,0.1)", border:`1px solid ${n.type==="waiter"?"rgba(61,191,176,0.2)":"rgba(139,92,246,0.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0 }}>
                {n.type==="waiter"?"◈":"◇"}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"14px", fontFamily:"var(--font-display)", fontStyle:"italic", color: n.read?"var(--muted)":"var(--cream)" }}>{n.tableName}</div>
                <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"2px", letterSpacing:"0.5px" }}>{n.message}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:"11px", color:"var(--gold)", fontFamily:"var(--font-display)" }}>{n.time?.toLocaleTimeString()}</div>
                {!n.read && <div style={{ fontSize:"7px", letterSpacing:"2px", color:"var(--gold)", marginTop:"4px" }}>NEW</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Analytics ───────────────────────────────────────────────────────── */
function AdminAnalytics({ store }) {
  const { dishes, categories, analytics } = store;
  const top = [...dishes].sort((a,b)=>(analytics.views[b.id]||0)-(analytics.views[a.id]||0)).slice(0,6);
  const maxV = Math.max(...top.map(d=>analytics.views[d.id]||0),1);
  const catData = [...categories].sort((a,b)=>(a.order??0)-(b.order??0)).map(c=>({ ...c, views: dishes.filter(d=>d.categoryId===c.id).reduce((s,d)=>s+(analytics.views[d.id]||0),0) }));

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Insights" sub="Performance Analytics" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"32px" }}>
        <Stat icon="◈" label="Total Scans" value={analytics.scans} color="var(--gold)" />
        <Stat icon="◎" label="Total Views" value={Object.values(analytics.views).reduce((a,b)=>a+b,0)} color="#8b5cf6" />
        <Stat icon="◉" label="Available Dishes" value={dishes.filter(d=>d.available).length} color="#10b981" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:"16px" }}>
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"28px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"24px" }}>Most Viewed Dishes</div>
          {top.map((dish,i) => {
            const v = analytics.views[dish.id]||0;
            const pct = (v/maxV)*100;
            return (
              <div key={dish.id} style={{ marginBottom:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                    <span style={{ fontSize:"9px", color:"var(--subtle)", width:"14px" }}>#{i+1}</span>
                    <span style={{ fontSize:"12px", color:"var(--cream)" }}>{dish.name.en}</span>
                  </div>
                  <span style={{ fontSize:"12px", fontFamily:"var(--font-display)", color:"var(--gold-light)" }}>{v}</span>
                </div>
                <div style={{ height:"2px", background:"rgba(255,255,255,0.05)" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,var(--gold),var(--amber))`, transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"28px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"24px" }}>Category Views</div>
          {catData.sort((a,b)=>b.views-a.views).map(cat => (
            <div key={cat.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"12px", color:"var(--gold)", opacity:0.6 }}>{cat.icon}</span>
                <span style={{ fontSize:"11px", color:"var(--cream)" }}>{cat.name.en}</span>
              </div>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"18px", color:"var(--gold-light)" }}>{cat.views}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WELCOME (language gate)
═══════════════════════════════════════════════════════════════════════════ */
const WELCOME_STORAGE_KEY = "tiflisi_welcome_v1";

/** `location.pathname` (React Router, after basename) or full `window.location.pathname` (e.g. …/admin on GitHub Pages). */
function pathMatchesAdmin(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  return p === "/admin" || p.endsWith("/admin");
}

function readTableIdFromUrl(search) {
  try {
    const s = search ?? (typeof window !== "undefined" ? window.location.search : "");
    const q = new URLSearchParams(s).get("table");
    if (q == null || q === "") return null;
    const trimmed = q.trim();
    const n = Number(trimmed);
    if (Number.isFinite(n) && String(n) === trimmed) return n;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

function readSavedWelcomeLang() {
  try {
    const raw = sessionStorage.getItem(WELCOME_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j?.lang && ["en", "ka", "ru"].includes(j.lang)) return j.lang;
  } catch {}
  return null;
}

/** Optimized Unsplash still — responsive srcSet, fixed dimensions hint for CLS. */
const WELCOME_HERO_SRC =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80";
const WELCOME_HERO_SRCSET =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=75 640w, " +
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=960&q=78 960w, " +
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1280&q=80 1280w, " +
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1920&q=82 1920w";

function WelcomeScreen({ onChooseLang, tableId, tables, onTableChange }) {
  const [finePointer, setFinePointer] = useState(false);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const mq = window.matchMedia("(pointer: fine)");
      const sync = () => setFinePointer(!!mq.matches);
      sync();
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    } catch {
      setFinePointer(false);
    }
  }, []);

  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced || !finePointer) return undefined;

    const onMove = (e) => {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const dx = (e.clientX - cx) / Math.max(cx, 1);
      const dy = (e.clientY - cy) / Math.max(cy, 1);
      setShift({ x: dx * 14, y: dy * 11 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [finePointer]);

  const imgTransform = finePointer ? `scale(1.1) translate3d(${shift.x}px, ${shift.y}px, 0)` : undefined;

  const tableList = Array.isArray(tables) ? tables : [];
  const showTable = tableList.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className={`welcome-hero-root${finePointer ? " welcome-hero--parallax" : ""}`}
    >
      <GlobalStyles />
      <FontLoader />
      <div className="noise" aria-hidden="true" />
      <div className="welcome-hero-media-wrap" aria-hidden="true">
        <img
          className="welcome-hero-img"
          src={WELCOME_HERO_SRC}
          srcSet={WELCOME_HERO_SRCSET}
          sizes="100vw"
          width={1920}
          height={1280}
          alt=""
          decoding="async"
          fetchPriority="high"
          style={imgTransform ? { transform: imgTransform } : undefined}
        />
      </div>
      <div className="welcome-hero-dark" aria-hidden="true" />
      <div className="welcome-hero-vignette" aria-hidden="true" />

      <div className="welcome-hero-inner">
        <header>
          <p className="welcome-hero-eyebrow">Georgian fine dining</p>
          <h1 id="welcome-title" className="welcome-hero-title">
            Welcome to Tiflisi
            <span>Fine dining</span>
          </h1>
          <p className="welcome-hero-sub">
            Scan the QR code to browse our menu and send orders from your table—crafted for a calm, unhurried evening.
          </p>
          <p className="welcome-hero-ka" lang="ka">
            კეთილი იყოს თქვენი მობრძანება · Welcome · Добро пожаловать
          </p>
        </header>

        <div className="welcome-hero-social">
          <SocialTopStrip />
        </div>

        {showTable && typeof onTableChange === "function" && (
          <div className="welcome-hero-table">
            <label htmlFor="welcome-table-select">Seating</label>
            <div className="welcome-hero-table-wrap">
              <select
                id="welcome-table-select"
                value={String(tableId)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const id = /^\d+$/.test(raw) ? Number(raw) : raw;
                  onTableChange(id);
                }}
              >
                {tableList.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.zone ? ` — ${t.zone}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="welcome-hero-divider" aria-hidden="true">
          <i />
          <span>ენა · Language</span>
          <i />
        </div>

        <div className="welcome-hero-actions">
          <button type="button" className="welcome-btn-primary" onClick={() => onChooseLang("ka")}>
            View menu
            <small>ქართული</small>
          </button>
          <button type="button" className="welcome-btn-ghost" onClick={() => onChooseLang("en")}>
            English
          </button>
          <button type="button" className="welcome-btn-ghost" onClick={() => onChooseLang("ru")}>
            Русский
          </button>
        </div>

        <p className="welcome-hero-hint">აირჩიეთ ენა მენიუს სანახავად · Choose a language to open the menu</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const store = useStore();
  const location = useLocation();
  const go = useNavigate();

  const isAdminRoute = useMemo(() => pathMatchesAdmin(location.pathname), [location.pathname]);

  const [enteredMenu, setEnteredMenu] = useState(() => {
    if (readSavedWelcomeLang() !== null) return true;
    if (typeof window === "undefined") return false;
    return pathMatchesAdmin(window.location.pathname);
  });
  const savedLang = readSavedWelcomeLang();
  const [lang, setLang] = useState(savedLang ?? "ka");
  const [tableId, setTableId] = useState(() => readTableIdFromUrl() ?? 1);
  const [adminAuth, setAdminAuth] = useState(false);

  useLayoutEffect(() => {
    if (isAdminRoute) setEnteredMenu(true);
  }, [isAdminRoute]);

  const syncTableParams = useCallback(
    (id) => {
      setTableId(id);
      try {
        const sp = new URLSearchParams(location.search);
        sp.set("table", String(id));
        const next = sp.toString();
        go({ search: next ? `?${next}` : "" }, { replace: true });
      } catch {
        /* ignore */
      }
    },
    [go, location.search]
  );

  useEffect(() => {
    if (store.tables.length === 0) return;
    setTableId((prev) => {
      if (store.tables.some((t) => String(t.id) === String(prev))) return prev;
      const u = readTableIdFromUrl(location.search);
      if (u != null && store.tables.some((t) => String(t.id) === String(u))) return u;
      return store.tables[0].id;
    });
  }, [store.tables, location.search]);

  useEffect(() => {
    const t = readTableIdFromUrl(location.search);
    if (t == null) return;
    if (store.tables.length > 0 && !store.tables.some((x) => String(x.id) === String(t))) return;
    setTableId(t);
  }, [location.search, store.tables]);

  useEffect(() => {
    document.documentElement.lang = lang === "ka" ? "ka" : lang === "ru" ? "ru" : "en";
  }, [lang]);

  const enterWithLang = useCallback((l) => {
    setLang(l);
    try {
      sessionStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({ lang: l }));
    } catch {}
    setEnteredMenu(true);
  }, []);

  return (
    <div>
      {!enteredMenu && !isAdminRoute && (
        <WelcomeScreen
          onChooseLang={enterWithLang}
          tableId={tableId}
          tables={store.tables}
          onTableChange={syncTableParams}
        />
      )}

      {enteredMenu && !isAdminRoute && <CustomerMenu tableId={tableId} store={store} lang={lang} />}
      {enteredMenu && isAdminRoute && !adminAuth && (
        <AdminLogin onLogin={() => { setAdminAuth(true); }} />
      )}
      {enteredMenu && isAdminRoute && adminAuth && (
        <AdminPanel store={store} onLogout={() => { setAdminAuth(false); go("/"); }} />
      )}
    </div>
  );
}
