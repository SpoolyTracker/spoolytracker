import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from './AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourContextType {
    startTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
    const { user, updateUser } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const driverRef = useRef<any>(null);
    const hasStartedRef = useRef(false);

    const handleTourEnd = useCallback(() => {
        if (user && user.introSeen === false) {
            api.setIntroSeen().catch(console.error);
            updateUser({ introSeen: true });
        }
    }, [user, updateUser]);

    const startTour = useCallback(() => {
        if (!user) return;

        // Navigate to dashboard first to ensure consistent start if not already there
        if (location.pathname !== '/dashboard') {
            navigate('/dashboard');
        }

        // Small delay to allow navigation and rendering
        setTimeout(() => {
            const steps: any[] = [
                {
                    element: '[data-tour="tour-dashboard"]',
                    popover: {
                        title: t('tour.welcome.title', 'Welcome to SpoolyTracker'),
                        description: t('tour.welcome.desc', 'Your central hub for tracking 3D printing materials. Here is a quick tour of the main features.'),
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="tour-profile"]',
                    popover: {
                        title: t('tour.profile.title', 'User Profile'),
                        description: t('tour.profile.desc', 'Access your profile settings, switch language, or logout from here. Click "Next" to visit your profile settings.'),
                        side: "bottom",
                        align: 'end',
                        onNextClick: () => {
                            navigate('/settings');
                            setTimeout(() => {
                                driverRef.current?.moveNext();
                            }, 500);
                        }
                    }
                },
                {
                    element: '[data-tour="settings-profile-section"]',
                    popover: {
                        title: t('tour.settings.title', 'Profile Settings'),
                        description: t('tour.settings.desc', 'Update your personal info and preferences here. You can also restart this tour from the preferences section.'),
                        side: "left",
                        align: 'start',
                        onNextClick: () => {
                            // Navigate to inventory for the next part
                            navigate('/inventory');
                            setTimeout(() => {
                                driverRef.current?.moveNext();
                            }, 800);
                        }
                    }
                },
                // --- INVENTORY SECTION ---
                {
                    element: '[data-tour="tour-inventory"]',
                    popover: {
                        title: t('tour.inventory.title', 'Inventory Management'),
                        description: t('tour.inventory.desc', 'Track your filament spools, check stock levels, and organize by brand or material.'),
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="inventory-add-btn"]',
                    popover: {
                        title: t('inventory.addFilament', 'Add Filament'),
                        description: t('tour.inventory.add', 'Click here to add a new spool. You can scan an NFC tag or manually enter details.'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="inventory-search"]',
                    popover: {
                        title: t('common.search', 'Search'),
                        description: t('tour.inventory.search', 'Quickly find filaments by name, brand, or color.'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="inventory-filters"]',
                    popover: {
                        title: t('inventory.filters', 'Filters'), // Provided key might not exist, fallback? t('common.filters')? Using hardcoded fallback just in case
                        description: t('tour.inventory.filters', 'Use advanced filters to narrow down your list by weight, material, or stock level.'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="inventory-view-options"]',
                    popover: {
                        title: t('inventory.view', 'View Options'),
                        description: t('tour.inventory.view', 'Switch between grouped list, flat cards, or data grid views.'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                // --- CONSUMPTION SECTION ---
                {
                    element: '[data-tour="tour-consumption"]',
                    popover: {
                        title: t('tour.consumption.title', 'Consumption History'),
                        description: t('tour.consumption.desc', 'View detailed logs of filament usage. Track manual adjustments and print jobs.'),
                        side: "right",
                        align: 'start',
                        onNextClick: () => {
                            navigate('/consumption');
                            setTimeout(() => {
                                driverRef.current?.moveNext();
                            }, 800);
                        }
                    }
                },
                {
                    element: '[data-tour="consumption-add-btn"]',
                    popover: {
                        title: t('consumption.addLog', 'Add Usage'),
                        description: t('tour.consumption.add', 'Log manual usage here (e.g. failed prints or waste).'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="consumption-tabs"]',
                    popover: {
                        title: t('common.tabs', 'Tabs'),
                        description: t('tour.consumption.tabs', 'Switch between History logs, Usage Analytics, and the Project Simulator.'),
                        side: "top",
                        align: 'center'
                    }
                },
                // --- REST OF TOUR ---
                {
                    element: '[data-tour="tour-projects"]',
                    popover: {
                        title: t('tour.projects.title', 'Project Management'),
                        description: t('tour.projects.desc', 'Organize prints into projects, track costs, and estimate profitability.'),
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="tour-gcode-analysis"]',
                    popover: {
                        title: t('tour.gcode.title', 'GCode Analysis'),
                        description: t('tour.gcode.desc', 'Upload your print files here to automatically estimate material cost and time before printing.'),
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="tour-refdata"]',
                    popover: {
                        title: t('tour.refdata.title', 'Reference Data'),
                        description: t('tour.refdata.desc', 'Manage brands, materials, and types. Admins can create global presets for the organization.'),
                        side: "right",
                        align: 'start'
                    }
                },
                {
                    element: '[data-tour="tour-ai-agent"]',
                    popover: {
                        title: t('tour.ai.title', 'Assistant Spooly IA 🌟'),
                        description: t('tour.ai.desc', 'Posez des questions sur votre stock, votre consommation ou vos projets ! Cliquez ici pour discuter.'),
                        side: "left",
                        align: 'end'
                    }
                }
            ];

            const driverInstance = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                doneBtnText: t('common.done', 'Done'),
                nextBtnText: t('common.next', 'Next'),
                prevBtnText: t('common.back', 'Previous'),
                progressText: t('tour.progress', 'Step {{current}} of {{total}}'),
                showButtons: ['next', 'previous', 'close'], // Ensure close button is shown
                onDestroyed: handleTourEnd, // Called when user closes early or finishes
                steps: steps,
                // Add jump to close button text or creating a custom one via popover is harder in v1 without custom UI
                // For now, rely on "Close" (X) or clicking overlay to skip.
            });

            driverRef.current = driverInstance;
            driverInstance.drive();
        }, 500);
    }, [user, navigate, location.pathname, t, handleTourEnd]);

    // Check for auto-start on mount/user load
    useEffect(() => {
        // Only if user is loaded and introSeen is false
        // And we haven't started it yet in this session (to prevent loops if logic fails)
        if (user && user.introSeen === false && !hasStartedRef.current) {
            hasStartedRef.current = true;
            setTimeout(() => {
                startTour();
            }, 1500);
        }
    }, [user, startTour]);

    return (
        <TourContext.Provider value={{ startTour }}>
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (!context) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
}
