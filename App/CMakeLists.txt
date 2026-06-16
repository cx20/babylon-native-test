# HelloWorld - Babylon Native Win32 sample
# Placed inside BabylonNative/Apps/HelloWorld/ by setup.ps1.
# Build from the BabylonNative root: cmake -B build\win32

# Babylon.js core bundles (copied flat into Scripts/)
set(BABYLON_SCRIPTS
    "../node_modules/babylonjs/babylon.max.js"
    "../node_modules/babylonjs-gui/babylon.gui.js"
    "../node_modules/babylonjs-loaders/babylonjs.loaders.js"
    "../node_modules/cannon/build/cannon.js"
    "../node_modules/@babylonjs/havok/lib/umd/HavokPhysics_umd.js"
    "../node_modules/@babylonjs/havok/lib/umd/HavokPhysics.wasm")

# App scripts (paths relative to this CMakeLists.txt; subdirectory structure preserved)
set(SCRIPTS
    "Scripts/hello_world.js"
    "Scripts/raymarching.js"
    "Scripts/physics.js"
    "Scripts/physics_havok.js"
    "Scripts/HavokPhysics_wasm_b64.js"
    "Scripts/HavokPhysics_compat.js"
    "Scripts/marbles.js"
    "Scripts/textures/environment.env"
    "Scripts/textures/papermillSpecularHDR.env"
    "Scripts/textures/grass.jpg"
    "Scripts/models/IridescenceMetallicSpheres/glTF/IridescenceMetallicSpheres.gltf"
    "Scripts/models/IridescenceMetallicSpheres/glTF/IridescenceMetallicSpheres.bin"
    "Scripts/models/IridescenceMetallicSpheres/glTF/textures/guides.png")

set(SOURCES
    "Win32/main.cpp")

# SUBSYSTEM:CONSOLE keeps stdout/stderr; wWinMainCRTStartup keeps the GUI entry point.
add_executable(HelloWorld ${BABYLON_SCRIPTS} ${SCRIPTS} ${SOURCES})
set_target_properties(HelloWorld PROPERTIES
    LINK_FLAGS "/SUBSYSTEM:CONSOLE /ENTRY:wWinMainCRTStartup")

target_compile_definitions(HelloWorld PRIVATE UNICODE _UNICODE)

# Embedding provides Runtime, View, and all built-in plugins/polyfills.
target_link_libraries(HelloWorld PRIVATE Embedding)

# Copy Babylon.js bundles flat into Scripts/
foreach(SCRIPT ${BABYLON_SCRIPTS})
    get_filename_component(SCRIPT_NAME "${SCRIPT}" NAME)
    add_custom_command(
        OUTPUT "${CMAKE_CFG_INTDIR}/Scripts/${SCRIPT_NAME}"
        COMMAND "${CMAKE_COMMAND}" -E copy
            "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}"
            "${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/Scripts/${SCRIPT_NAME}"
        COMMENT "Copying ${SCRIPT_NAME}"
        MAIN_DEPENDENCY "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}")
endforeach()

# Copy app scripts preserving subdirectory structure under Scripts/
foreach(SCRIPT ${SCRIPTS})
    file(RELATIVE_PATH REL_PATH
        "${CMAKE_CURRENT_SOURCE_DIR}/Scripts"
        "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}")
    set(OUTPUT_FILE "${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/Scripts/${REL_PATH}")
    get_filename_component(OUTPUT_DIR "${OUTPUT_FILE}" DIRECTORY)
    add_custom_command(
        OUTPUT "${OUTPUT_FILE}"
        COMMAND "${CMAKE_COMMAND}" -E make_directory "${OUTPUT_DIR}"
        COMMAND "${CMAKE_COMMAND}" -E copy
            "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}"
            "${OUTPUT_FILE}"
        COMMENT "Copying ${REL_PATH}"
        MAIN_DEPENDENCY "${CMAKE_CURRENT_SOURCE_DIR}/${SCRIPT}")
endforeach()

set_property(TARGET HelloWorld PROPERTY FOLDER Apps)
