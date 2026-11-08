/**
 * Messages of every locale, assembled from one JSON file per namespace (spec 15).
 * To add a namespace, create `<Namespace>.json` in each locale folder and list it here.
 */

import enApp from './en/App.json';
import enArchive from './en/Archive.json';
import enAuth from './en/Auth.json';
import enCell from './en/Cell.json';
import enCommon from './en/Common.json';
import enDashboard from './en/Dashboard.json';
import enGames from './en/Games.json';
import enGuide from './en/Guide.json';
import enHome from './en/Home.json';
import enLabels from './en/Labels.json';
import enLoginPage from './en/LoginPage.json';
import enNav from './en/Nav.json';
import enNotifications from './en/Notifications.json';
import enPreparedResolutionsDialog from './en/PreparedResolutionsDialog.json';
import enProfile from './en/Profile.json';
import enRegisterPage from './en/RegisterPage.json';
import enResolutionForm from './en/ResolutionForm.json';
import enResolutionHistoryDialog from './en/ResolutionHistoryDialog.json';
import enResolutionList from './en/ResolutionList.json';
import enResolutionsPage from './en/ResolutionsPage.json';
import enTeams from './en/Teams.json';
import enThreads from './en/Threads.json';
import enVerify from './en/Verify.json';
import deApp from './de/App.json';
import deArchive from './de/Archive.json';
import deAuth from './de/Auth.json';
import deCell from './de/Cell.json';
import deCommon from './de/Common.json';
import deDashboard from './de/Dashboard.json';
import deGames from './de/Games.json';
import deGuide from './de/Guide.json';
import deHome from './de/Home.json';
import deLabels from './de/Labels.json';
import deLoginPage from './de/LoginPage.json';
import deNav from './de/Nav.json';
import deNotifications from './de/Notifications.json';
import dePreparedResolutionsDialog from './de/PreparedResolutionsDialog.json';
import deProfile from './de/Profile.json';
import deRegisterPage from './de/RegisterPage.json';
import deResolutionForm from './de/ResolutionForm.json';
import deResolutionHistoryDialog from './de/ResolutionHistoryDialog.json';
import deResolutionList from './de/ResolutionList.json';
import deResolutionsPage from './de/ResolutionsPage.json';
import deTeams from './de/Teams.json';
import deThreads from './de/Threads.json';
import deVerify from './de/Verify.json';
import itApp from './it/App.json';
import itArchive from './it/Archive.json';
import itAuth from './it/Auth.json';
import itCell from './it/Cell.json';
import itCommon from './it/Common.json';
import itDashboard from './it/Dashboard.json';
import itGames from './it/Games.json';
import itGuide from './it/Guide.json';
import itHome from './it/Home.json';
import itLabels from './it/Labels.json';
import itLoginPage from './it/LoginPage.json';
import itNav from './it/Nav.json';
import itNotifications from './it/Notifications.json';
import itPreparedResolutionsDialog from './it/PreparedResolutionsDialog.json';
import itProfile from './it/Profile.json';
import itRegisterPage from './it/RegisterPage.json';
import itResolutionForm from './it/ResolutionForm.json';
import itResolutionHistoryDialog from './it/ResolutionHistoryDialog.json';
import itResolutionList from './it/ResolutionList.json';
import itResolutionsPage from './it/ResolutionsPage.json';
import itTeams from './it/Teams.json';
import itThreads from './it/Threads.json';
import itVerify from './it/Verify.json';

const en = {
  App: enApp,
  Archive: enArchive,
  Auth: enAuth,
  Cell: enCell,
  Common: enCommon,
  Dashboard: enDashboard,
  Games: enGames,
  Guide: enGuide,
  Home: enHome,
  Labels: enLabels,
  LoginPage: enLoginPage,
  Nav: enNav,
  Notifications: enNotifications,
  PreparedResolutionsDialog: enPreparedResolutionsDialog,
  Profile: enProfile,
  RegisterPage: enRegisterPage,
  ResolutionForm: enResolutionForm,
  ResolutionHistoryDialog: enResolutionHistoryDialog,
  ResolutionList: enResolutionList,
  ResolutionsPage: enResolutionsPage,
  Teams: enTeams,
  Threads: enThreads,
  Verify: enVerify,
};

const de = {
  App: deApp,
  Archive: deArchive,
  Auth: deAuth,
  Cell: deCell,
  Common: deCommon,
  Dashboard: deDashboard,
  Games: deGames,
  Guide: deGuide,
  Home: deHome,
  Labels: deLabels,
  LoginPage: deLoginPage,
  Nav: deNav,
  Notifications: deNotifications,
  PreparedResolutionsDialog: dePreparedResolutionsDialog,
  Profile: deProfile,
  RegisterPage: deRegisterPage,
  ResolutionForm: deResolutionForm,
  ResolutionHistoryDialog: deResolutionHistoryDialog,
  ResolutionList: deResolutionList,
  ResolutionsPage: deResolutionsPage,
  Teams: deTeams,
  Threads: deThreads,
  Verify: deVerify,
};

const it = {
  App: itApp,
  Archive: itArchive,
  Auth: itAuth,
  Cell: itCell,
  Common: itCommon,
  Dashboard: itDashboard,
  Games: itGames,
  Guide: itGuide,
  Home: itHome,
  Labels: itLabels,
  LoginPage: itLoginPage,
  Nav: itNav,
  Notifications: itNotifications,
  PreparedResolutionsDialog: itPreparedResolutionsDialog,
  Profile: itProfile,
  RegisterPage: itRegisterPage,
  ResolutionForm: itResolutionForm,
  ResolutionHistoryDialog: itResolutionHistoryDialog,
  ResolutionList: itResolutionList,
  ResolutionsPage: itResolutionsPage,
  Teams: itTeams,
  Threads: itThreads,
  Verify: itVerify,
};

/** The message shape every locale must match; `en` is the reference. */
export type Messages = typeof en;

/** Resolves to `true` only when A and B have exactly the same shape. */
type SameShape<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

// Fails the type check when a locale has a missing or an extra key.
const deMatchesEn: SameShape<typeof de, Messages> = true;
const itMatchesEn: SameShape<typeof it, Messages> = true;
void deMatchesEn;
void itMatchesEn;

export const messages = { en, de, it } satisfies Record<string, Messages>;
