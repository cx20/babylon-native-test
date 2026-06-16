// Babylon Native Hello World - Win32 host
// Creates a window, initializes Babylon::Embedding Runtime + View,
// loads babylon.max.js and hello_world.js, then runs the render loop.

#include <Babylon/Embedding/LogLevel.h>
#include <Babylon/Embedding/Runtime.h>
#include <Babylon/Embedding/View.h>

#include <Windows.h>

#include <cstdio>
#include <optional>
#include <string>

static std::optional<Babylon::Embedding::Runtime> g_runtime;
static std::optional<Babylon::Embedding::View>    g_view;
static bool g_minimized = false;

static void LoadScripts()
{
    // Bootstrap Babylon.js core, then our scene script.
    g_runtime->LoadScript("app:///Scripts/babylon.max.js");
    g_runtime->LoadScript("app:///Scripts/hello_world.js");
}

static void InitializeBabylon(HWND hWnd)
{
    ::SetConsoleOutputCP(CP_UTF8);

    Babylon::Embedding::RuntimeOptions opts{};
    opts.log = [](Babylon::Embedding::LogLevel /*level*/, std::string_view msg)
    {
        std::string line(msg);
        while (!line.empty() && (line.back() == '\n' || line.back() == '\r'))
            line.pop_back();
        line += '\n';
        ::OutputDebugStringA(line.c_str());
        std::fputs(line.c_str(), stdout);
    };

    g_runtime.emplace(opts);
    LoadScripts();

    // Attach the View; this triggers GPU device init and script execution.
    g_view.emplace(*g_runtime, hWnd);

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
    // Order matters: tear down View (unbinds surface) before Runtime (joins JS thread).
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

    InitializeBabylon(hWnd);

    ::ShowWindow(hWnd, nCmdShow);
    ::UpdateWindow(hWnd);

    MSG msg{};
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
