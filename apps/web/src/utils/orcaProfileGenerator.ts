import type { Filament } from '../api';

// OrcaSlicer / Bambu Studio printer preset names follow "<model> <nozzle> nozzle".
// Grouped by brand for the export dialog. Not exhaustive: the dialog also offers a
// free-text "custom" option so any printer (any slicer) can be targeted exactly.
export const PRINTER_PRESET_GROUPS: { group: string; models: string[] }[] = [
    {
        group: 'Bambu Lab',
        models: [
            'Bambu Lab X1 Carbon',
            'Bambu Lab X1',
            'Bambu Lab X1E',
            'Bambu Lab P1S',
            'Bambu Lab P1P',
            'Bambu Lab A1',
            'Bambu Lab A1 mini',
            'Bambu Lab H2D',
        ],
    },
    {
        group: 'Prusa',
        models: ['Prusa MK4S', 'Prusa MK4', 'Prusa MK3.5', 'Prusa MINI', 'Prusa XL', 'Prusa CORE One'],
    },
    {
        group: 'Creality',
        models: ['Creality Ender-3 V3', 'Creality Ender-3 V3 KE', 'Creality K1', 'Creality K1 Max', 'Creality K1C', 'Creality CR-10'],
    },
    {
        group: 'Voron',
        models: ['Voron 2.4 250', 'Voron 2.4 300', 'Voron Trident 250', 'Voron Trident 300'],
    },
    {
        group: 'Autres',
        models: ['Sovol SV06', 'Sovol SV08', 'Anycubic Kobra 2', 'Elegoo Neptune 4', 'Qidi X-Plus 3'],
    },
];
export const NOZZLE_SIZES = ['0.2', '0.4', '0.6', '0.8'];
export const composePrinterPreset = (model: string, nozzle: string) => `${model} ${nozzle} nozzle`;

// Default target printer. User filament presets are printer-specific: the preset name
// ends with "@<printer>" and compatible_printers lists that one printer.
export const DEFAULT_TARGET_PRINTER = composePrinterPreset('Bambu Lab P1S', '0.4');

export const generateOrcaProfile = (filament: Filament, targetPrinter: string = DEFAULT_TARGET_PRINTER) => {
    // Determine basics
    const materialType = filament.material?.name || 'PLA';
    const vendor = filament.brand?.name || filament.vendor || 'Generic';
    const colorHex = filament.color || '#000000';
    const colorName = filament.colorName || '';
    const stableHash = `${filament.id}-${vendor}-${materialType}-${colorName}-${colorHex}`
        .split('')
        .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 0);
    const profileId = `P${stableHash.toString(16).padStart(7, '0').slice(0, 7)}`;

    // Temps - Default to safe values if missing
    // Logic: If we have min/max, average them. If we have only one, use it. If none, defaults.
    const defaultNozzle = materialType.includes('PLA') ? 210 : materialType.includes('PETG') ? 240 : materialType.includes('ABS') ? 250 : 220;
    const defaultBed = materialType.includes('PLA') ? 55 : materialType.includes('PETG') ? 70 : materialType.includes('ABS') ? 100 : 60;
    const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    const valueOrNilArray = (value: unknown) => hasNumber(value) ? [String(value)] : ["nil"];
    const roundedArray = (value: unknown, fallback = 0) => [String(Math.round(hasNumber(value) ? value : fallback))];

    const nozzleTempFirst = filament.nozzleTempMax || defaultNozzle;
    // Print nozzle temperature:
    // - If conditional temperature-by-speed rules exist, use the highest rule temperature
    //   (each rule's upper bound, falling back to its lower bound). Example: a rule
    //   210-220 C exports 220 C.
    // - Otherwise, the configured max minus a 20 C margin (the absolute max is the ceiling,
    //   not the everyday print temp). If no max is set at all, fall back to the default.
    const conditionalRuleTemps = (filament.conditionalTemperatureRules || [])
        .map((rule) => (hasNumber(rule.nozzleTempMax) ? rule.nozzleTempMax : hasNumber(rule.nozzleTempMin) ? rule.nozzleTempMin : null))
        .filter((value): value is number => value != null);
    const printNozzleTemp = conditionalRuleTemps.length > 0
        ? Math.max(...conditionalRuleTemps)
        : hasNumber(filament.nozzleTempMax)
            ? filament.nozzleTempMax - 20
            : defaultNozzle;

    const bedTempFirst = filament.bedTempMax || defaultBed;
    const bedTempOther = filament.bedTempMin || filament.bedTemp || defaultBed;
    const bedTempProfile = bedTempFirst || bedTempOther;

    // Density
    const density = filament.densityGcm3 || (materialType.includes('PLA') ? 1.24 : materialType.includes('PETG') ? 1.27 : 1.05);
    const diameter = filament.diameterMm || 1.75;
    const chamberTemp = filament.chamberTempMax || filament.chamberTempMin || 0;
    const hasZHop = hasNumber(filament.retractionZHopMm);
    const hasPressureAdvance = hasNumber(filament.kFactor);
    const maxVolumetricSpeed = hasNumber(filament.maxVolumetricSpeedMm3S)
        ? filament.maxVolumetricSpeedMm3S
        : 12;
    const flowRatio = hasNumber(filament.flowRatio) ? filament.flowRatio : 0.98;
    const conditionalTemperatureNotes = (filament.conditionalTemperatureRules || [])
        .map((rule) => {
            const speedMin = rule.speedMinMmS != null ? `${rule.speedMinMmS}` : '';
            const speedMax = rule.speedMaxMmS != null ? `${rule.speedMaxMmS}` : '';
            const speedRange = speedMin && speedMax ? `${speedMin}-${speedMax} mm/s` : speedMin ? `>= ${speedMin} mm/s` : speedMax ? `<= ${speedMax} mm/s` : 'any speed';
            const tempMin = rule.nozzleTempMin != null ? `${rule.nozzleTempMin}` : '';
            const tempMax = rule.nozzleTempMax != null ? `${rule.nozzleTempMax}` : '';
            const tempRange = tempMin && tempMax ? `${tempMin}-${tempMax} C` : tempMin ? `${tempMin} C` : tempMax ? `${tempMax} C` : 'no temp';
            return `- ${speedRange}: ${tempRange}${rule.notes ? ` (${rule.notes})` : ''}`;
        });
    const notes = [
        filament.retractionNotes ? `Retraction notes: ${filament.retractionNotes}` : '',
        hasNumber(filament.dryTemp) || hasNumber(filament.dryTime)
            ? `Drying: ${hasNumber(filament.dryTemp) ? `${filament.dryTemp} C` : '? C'}${hasNumber(filament.dryTime) ? ` for ${filament.dryTime} h` : ''}`
            : '',
        hasNumber(filament.printSpeedMin) || hasNumber(filament.printSpeedMax)
            ? `Recommended speed: ${hasNumber(filament.printSpeedMin) ? filament.printSpeedMin : '?'}-${hasNumber(filament.printSpeedMax) ? filament.printSpeedMax : '?'} mm/s`
            : '',
        conditionalTemperatureNotes.length > 0
            ? `Nozzle temperature by speed:\n${conditionalTemperatureNotes.join('\n')}`
            : '',
    ].filter(Boolean).join('\n\n');

    const baseName = `${vendor} ${materialType}${colorName ? ` ${colorName}` : ''}`.trim();
    // Bambu Studio user filament presets are named "<filament> @<printer>" and bound to
    // exactly that printer via compatible_printers. This is what registers the profile as
    // a selectable custom filament (visible in the AMS material list), as opposed to a bare
    // printer-scoped override. Matches the structure of working user-exported presets.
    const profileName = `${baseName} @${targetPrinter}`;
    const isPetg = materialType.toUpperCase().includes('PETG');

    return {
        // --- Bambu Studio user filament preset metadata ---
        // No "type" / "instantiation" / "setting_id": those mark SYSTEM/bundle profiles.
        // User filament presets omit them, otherwise Bambu Studio does not register the
        // profile as a custom filament (it would not appear in the AMS material list).
        "activate_air_filtration": ["0"],
        "additional_cooling_fan_speed": ["0"],
        "additional_fan_full_speed_layer": ["0"],
        "chamber_temperatures": roundedArray(chamberTemp),
        "circle_compensation_speed": ["200"],
        "close_additional_fan_first_x_layers": ["3"],
        "close_fan_the_first_x_layers": ["3"],
        // Single printer matching the "@<printer>" suffix in name/filament_settings_id.
        "compatible_printers": [targetPrinter],
        "compatible_printers_condition": "",
        "compatible_prints": [],
        "compatible_prints_condition": "",
        "complete_print_exhaust_fan_speed": ["70"],
        "cool_plate_temp": isPetg ? ["0"] : roundedArray(Math.min(bedTempProfile, 35)),
        "cool_plate_temp_initial_layer": isPetg ? ["0"] : roundedArray(Math.min(bedTempProfile, 35)),
        "cooling_perimeter_transition_distance": ["10"],
        "cooling_slowdown_logic": ["uniform_cooling"],
        "counter_coef_1": ["0"],
        "counter_coef_2": ["0.025"],
        "counter_coef_3": ["-0.11"],
        "counter_limit_max": ["0.05"],
        "counter_limit_min": ["-0.04"],
        "default_filament_colour": [colorHex],
        "diameter_limit": ["50"],
        "during_print_exhaust_fan_speed": ["70"],
        "enable_overhang_bridge_fan": ["1"],
        "enable_pressure_advance": [hasPressureAdvance ? "1" : "0"],
        "eng_plate_temp": isPetg ? roundedArray(bedTempProfile) : ["0"],
        "eng_plate_temp_initial_layer": isPetg ? roundedArray(bedTempProfile) : ["0"],
        "fan_cooling_layer_time": ["60"],
        "fan_max_speed": [isPetg ? "30" : "100"],
        "fan_min_speed": [isPetg ? "10" : "35"],
        "filament_adaptive_volumetric_speed": ["0"],
        "filament_adhesiveness_category": ["0"],
        "filament_bridge_speed": ["25"],
        "filament_change_length": ["10"],
        "filament_change_length_nc": ["10"],
        "filament_cooling_before_tower": ["0"],
        "filament_cost": [filament.price ? String(filament.price) : "20"],
        "filament_density": [String(density)],
        "filament_deretraction_speed": ["nil"],
        "filament_dev_ams_drying_ams_limitations": [""],
        "filament_dev_ams_drying_heat_distortion_temperature": ["0"],
        "filament_dev_ams_drying_temperature": hasNumber(filament.dryTemp) ? [String(Math.round(filament.dryTemp))] : ["0"],
        "filament_dev_ams_drying_time": hasNumber(filament.dryTime) ? [String(Math.round(filament.dryTime))] : ["0"],
        "filament_dev_chamber_drying_bed_temperature": ["0"],
        "filament_dev_chamber_drying_time": ["0"],
        "filament_dev_drying_cooling_temperature": ["0"],
        "filament_dev_drying_softening_temperature": ["0"],
        "filament_diameter": [String(diameter)],
        "filament_enable_overhang_speed": ["1"],
        "filament_end_gcode": ["; filament end gcode \nM106 P3 S0\n"],
        "filament_extruder_compatibility": ["0"],
        "filament_extruder_variant": ["Direct Drive Standard"], // Assuming direct drive, safest default?
        "filament_flow_ratio": [String(flowRatio)],
        "filament_flush_temp": ["0"],
        "filament_flush_volumetric_speed": ["0"],
        "filament_id": profileId, // String, not array
        "filament_is_support": ["0"],
        "filament_long_retractions_when_cut": ["nil"],
        "filament_max_volumetric_speed": [String(maxVolumetricSpeed)],
        "filament_metal_stickiness": ["None"],
        "filament_minimal_purge_on_wipe_tower": ["15"],
        "filament_notes": notes,
        "filament_overhang_1_4_speed": ["0"],
        "filament_overhang_2_4_speed": ["0"],
        "filament_overhang_3_4_speed": ["0"],
        "filament_overhang_4_4_speed": ["0"],
        "filament_overhang_totally_speed": ["10"],
        "filament_pre_cooling_temperature": ["0"],
        "filament_pre_cooling_temperature_nc": ["0"],
        "filament_preheat_temperature_delta": ["0"],
        "filament_prime_volume": ["45"],
        "filament_prime_volume_nc": ["60"],
        "filament_printable": ["3"],
        "filament_ramming_travel_time": ["0"],
        "filament_ramming_travel_time_nc": ["0"],
        "filament_ramming_volumetric_speed": ["-1"],
        "filament_ramming_volumetric_speed_nc": ["-1"],
        "filament_retract_before_wipe": ["nil"],
        "filament_retract_length_nc": ["10"],
        "filament_retract_restart_extra": ["nil"],
        "filament_retract_when_changing_layer": ["nil"],
        "filament_retraction_distances_when_cut": ["nil"],
        "filament_retraction_length": valueOrNilArray(filament.retractionDistanceMm),
        "filament_retraction_minimum_travel": ["nil"],
        "filament_retraction_speed": valueOrNilArray(filament.retractionSpeedMmS),
        "filament_scarf_gap": ["0"],
        "filament_scarf_height": ["10%"],
        "filament_scarf_length": ["10"],
        "filament_scarf_seam_type": ["none"],
        "filament_settings_id": [profileName], // ARRAY!
        "filament_shrink": ["100%"],
        "filament_soluble": ["0"],
        "filament_start_gcode": ["; filament start gcode\n"],
        "filament_tower_interface_pre_extrusion_dist": ["10"],
        "filament_tower_interface_pre_extrusion_length": ["0"],
        "filament_tower_interface_print_temp": ["-1"],
        "filament_tower_interface_purge_volume": ["20"],
        "filament_tower_ironing_area": ["4"],
        "filament_type": [materialType],
        "filament_velocity_adaptation_factor": ["1"],
        "filament_vendor": [vendor],
        "filament_wipe": ["nil"],
        "filament_wipe_distance": ["nil"],
        "filament_z_hop": valueOrNilArray(filament.retractionZHopMm),
        "filament_z_hop_types": [hasZHop ? "Spiral Lift" : "nil"],
        "first_x_layer_fan_speed": ["0"],
        "first_x_layer_part_fan_speed": ["0"],
        "from": "User", // String
        "full_fan_speed_layer": ["0"],
        "hole_coef_1": ["0"],
        "hole_coef_2": ["-0.025"],
        "hole_coef_3": ["0.28"],
        "hole_limit_max": ["0.25"],
        "hole_limit_min": ["0.08"],
        "hot_plate_temp": roundedArray(bedTempProfile),
        "hot_plate_temp_initial_layer": roundedArray(bedTempProfile),
        "impact_strength_z": ["0"],
        "inherits": "",
        "ironing_fan_speed": ["-1"],
        "long_retractions_when_ec": ["0"],
        "name": profileName, // String
        "no_slow_down_for_cooling_on_outwalls": ["0"],
        "nozzle_temperature": [String(Math.round(printNozzleTemp))],
        "nozzle_temperature_initial_layer": [String(Math.round(printNozzleTemp))],
        "nozzle_temperature_range_high": [String(Math.round(filament.nozzleTempMax || (nozzleTempFirst + 20)))],
        "nozzle_temperature_range_low": [String(Math.round(filament.nozzleTempMin || (nozzleTempFirst - 20)))],
        "overhang_fan_speed": ["90"],
        "overhang_fan_threshold": ["10%"],
        "overhang_threshold_participating_cooling": ["95%"],
        "override_process_overhang_speed": ["0"],
        "pre_start_fan_time": ["0"],
        "pressure_advance": [hasPressureAdvance ? String(filament.kFactor) : "0.02"],
        "reduce_fan_stop_start_freq": ["1"],
        "required_nozzle_HRC": ["3"],
        "retraction_distances_when_ec": ["10"],
        "slow_down_for_layer_cooling": ["1"],
        "slow_down_layer_time": ["12"],
        "slow_down_min_speed": ["10"],
        "supertack_plate_temp": roundedArray(isPetg ? bedTempProfile + 10 : Math.max(0, bedTempProfile - 10)),
        "supertack_plate_temp_initial_layer": roundedArray(isPetg ? bedTempProfile + 10 : Math.max(0, bedTempProfile - 10)),
        "temperature_vitrification": ["0"],
        "textured_plate_temp": [String(Math.round(bedTempOther || bedTempFirst))],
        "textured_plate_temp_initial_layer": [String(Math.round(bedTempFirst))],
        "version": "2.4.0.1",
        "volumetric_speed_coefficients": [""]
    };
};
