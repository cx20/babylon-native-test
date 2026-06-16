// Babylon Native Hello World - Win32 host

#include <Babylon/Embedding/LogLevel.h>
#include <Babylon/Embedding/Runtime.h>
#include <Babylon/Embedding/View.h>

#include <Windows.h>

#include <chrono>
#include <cstdio>
#include <optional>
#include <string>

// ---------------------------------------------------------------------------
// パフォーマンス計測
// ---------------------------------------------------------------------------
static auto g_tStart = std::chrono::steady_clock::now();

static long long ElapsedMs()
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - g_tStart).count();
}

static void PerfLog(const char* label)
{
    printf("[PERF C++] %6lld ms  %s\n", ElapsedMs(), label);
    fflush(stdout);
}

// ---------------------------------------------------------------------------

static std::optional<Babylon::Embedding::Runtime> g_runtime;
static std::optional<Babylon::Embedding::View>    g_view;
static bool g_minimized = false;

static void LoadScripts()
{
    g_runtime->LoadScript("app:///Scripts/babylon.max.js");
    g_runtime->LoadScript("app:///Scripts/babylon.gui.js");

    // --- シーン選択: 使いたいブロックだけ有効化 ---

    // --- シーン選択: 使いたいブロックだけ有効化 ---

    // [A] Marbles (Havok + GLTF スフィア) ← 現在有効
    g_runtime->LoadScript("app:///Scripts/babylonjs.loaders.js");
    g_runtime->LoadScript("app:///Scripts/HavokPhysics_compat.js");
    g_runtime->LoadScript("app:///Scripts/HavokPhysics_wasm_b64.js");
    g_runtime->LoadScript("app:///Scripts/marbles.js");

    // [B] Physics v2 (Havok) ボックスサンプル
    // g_runtime->LoadScript("app:///Scripts/HavokPhysics_compat.js");
    // g_runtime->LoadScript("app:///Scripts/HavokPhysics_wasm_b64.js");
    // g_runtime->LoadScript("app:///Scripts/physics_havok.js");

    // [C] Physics v1 (Cannon.js) サンプル
    // g_runtime->LoadScript("app:///Scripts/cannon.js");
    // g_runtime->LoadScript("app:///Scripts/physics.js");

    // [D] レイマーチングサンプル
    // g_runtime->LoadScript("app:///Scripts/raymarching.js");
}

static void InitializeBabylon(HWND hWnd)
{
    ::SetConsoleOutputCP(CP_UTF8);

    PerfLog("InitializeBabylon start");

    Babylon::Embedding::RuntimeOptions opts{};
    opts.log = [](Babylon::Embedding::LogLevel /*level*/, std::string_view msg)
    {
        std::string line(msg);
        while (!line.empty() && (line.back() == '\n' || line.back() == '\r'))
            line.pop_back();
        line += '\n';
        ::OutputDebugStringA(line.c_str());
        std::fputs(line.c_str(), stdout);
        fflush(stdout);
    };

    g_runtime.emplace(opts);
    PerfLog("Runtime created (JS thread started)");

    LoadScripts();
    PerfLog("LoadScript() calls queued (async)");

    // View attach: GPU デバイス初期化 + スクリプトキューを JS スレッドへ投入
    g_view.emplace(*g_runtime, hWnd);
    PerfLog("View attached (GPU init done, scripts executing on JS thread)");

    RECT rect{};
    if (::GetClientRect(hWnd, &rect))
    {
        g_view->Resize(
            static_cast<uint32_t>(rect.right  - rect.left),
            static_cast<uint32_t>(rect.bottom - rect.top),
            Babylon::Embedding::CoordinateUnits::Physical);
    }
}

static void Uninitialize()
{
    g_view.reset();
    g_runtime.reset();
}

static LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    using CoordinateUnits = Babylon::Embedding::CoordinateUnits;

    switch (msg)
    {
    case WM_SYSCOMMAND:
        if ((wParam & 0xFFF0) == SC_MINIMIZE)
        {
            if (g_runtime) g_runtime->Suspend();
            g_minimized = true;
        }
        else if ((wParam & 0xFFF0) == SC_RESTORE && g_minimized)
        {
            g_minimized = false;
            if (g_runtime) g_runtime->Resume();
        }
        return ::DefWindowProc(hWnd, msg, wParam, lParam);

    case WM_SIZE:
        if (g_view)
        {
            g_view->Resize(
                static_cast<uint32_t>(LOWORD(lParam)),
                static_cast<uint32_t>(HIWORD(lParam)),
                CoordinateUnits::Physical);
        }
        break;

    case WM_DESTROY:
        Uninitialize();
        ::PostQuitMessage(0);
        break;

    default:
        return ::DefWindowProc(hWnd, msg, wParam, lParam);
    }
    return 0;
}

int APIENTRY wWinMain(
    _In_     HINSTANCE hInstance,
    _In_opt_ HINSTANCE /*hPrevInstance*/,
    _In_     LPWSTR    /*lpCmdLine*/,
    _In_     int       nCmdShow)
{
    // 計測開始はプロセス起動直後
    g_tStart = std::chrono::steady_clock::now();
    PerfLog("wWinMain start");

    WNDCLASSEXW wcex{};
    wcex.cbSize        = sizeof(WNDCLASSEXW);
    wcex.style         = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc   = WndProc;
    wcex.hInstance     = hInstance;
    wcex.hCursor       = ::LoadCursor(nullptr, IDC_ARROW);
    wcex.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1);
    wcex.lpszClassName = L"BabylonNativeHelloWorld";
    if (!::RegisterClassExW(&wcex)) return -1;

    HWND hWnd = ::CreateWindowExW(
        0,
        L"BabylonNativeHelloWorld",
        L"Babylon Native - Hello World",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1280, 720,
        nullptr, nullptr, hInstance, nullptr);
    if (!hWnd) return -1;

    PerfLog("Window created");

    InitializeBabylon(hWnd);

    ::ShowWindow(hWnd, nCmdShow);
    ::UpdateWindow(hWnd);

    MSG msg{};
    int  frameCount   = 0;
    bool firstFrame   = true;
    auto lastFpsTime  = std::chrono::steady_clock::now();

    while (msg.message != WM_QUIT)
    {
        if (g_minimized)
        {
            if (::GetMessage(&msg, nullptr, 0, 0) > 0)
            {
                ::TranslateMessage(&msg);
                ::DispatchMessage(&msg);
            }
        }
        else
        {
            if (g_view) g_view->RenderFrame();
            ++frameCount;

            if (firstFrame)
            {
                PerfLog("First RenderFrame() called");
                firstFrame = false;
            }

            // 1 秒ごとにタイトルバーの FPS を更新
            auto now = std::chrono::steady_clock::now();
            auto ms  = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastFpsTime).count();
            if (ms >= 1000)
            {
                float fps = frameCount * 1000.0f / static_cast<float>(ms);
                wchar_t title[128];
                swprintf_s(title, L"Babylon Native - Hello World  |  FPS: %.0f", fps);
                ::SetWindowTextW(hWnd, title);
                frameCount  = 0;
                lastFpsTime = now;
            }

            if (::PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE))
            {
                if (msg.message == WM_QUIT) break;
                ::TranslateMessage(&msg);
                ::DispatchMessage(&msg);
            }
        }
    }

    return static_cast<int>(msg.wParam);
}
