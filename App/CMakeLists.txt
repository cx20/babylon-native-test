# HelloWorld - Babylon Native Win32 sample
# Placed inside BabylonNative/Apps/HelloWorld/ by setup.ps1.
# Build from the BabylonNative root: cmake -B build\win32

# Babylon.js core bundle (required); additional bundles can be appended.
set(BABYLON_SCRIPTS
    "../node_modules/babylonjs/babylon.max.js"
    "../node_modules/babylonjs-gui/babylon.gui.js")

set(SCRIPTS
    "Scripts/hello_world.js"
    "Scripts/raymarching.js"
    "Scripts/environment.env")

set(SOURCES
    "Win32/main.cpp")

# SUBSYSTEM:CONSOLE keeps stdout/stderr; wWinMainCRTStartup keeps the GUI entry point.
add_executable(HelloWorld ${BABYLON_SCRIPTS} ${SCRIPTS} ${SOURCES})
set_target_properties(HelloWorld PROPERTIES
    LINK_FLAGS "/SUBSYSTEM:CONSOLE /ENTRY:wWinMainCRTStartup")

target_compile_definitions(HelloWorld PRIVATE UNICODE _UNICODE)

# Embedding provides Runtime, View, and all built-in plugins/polyfills.
target_link_libraries(HelloWorld PRIVATE Embedding)

# Copy scripts next to the executable so "app:///Scripts/..." resolves correctly.
foreach(SCRIPT ${SCRIPTS} ${BABYLON_SCRIPTS})
    get_filename_component(SCRIPT_NAME "${SCRIPT}" NAME)
    add_custom_command(
        OUTPUT "${CMAKE_CFG_INTDIR}/Scripts/${SCRIPT_NAME}"
        COMMAND "${CMAKE_COMMAND}" -E copy
            "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}"
            "${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/Scripts/${SCRIPT_NAME}"
        COMMENT "Copying ${SCRIPT_NAME}"
        MAIN_DEPENDENCY "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}")
endforeach()

set_property(TARGET HelloWorld PROPERTY FOLDER Apps)
