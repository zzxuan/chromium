// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_FULLSCREEN_CONTROLLER_H_
#define CHROME_BROWSER_UI_FULLSCREEN_CONTROLLER_H_
#pragma once

#include "base/basictypes.h"
#include "base/memory/ref_counted.h"
#include "chrome/browser/ui/fullscreen_exit_bubble_type.h"
#include "chrome/common/content_settings.h"

class Browser;
class BrowserWindow;
class GURL;
class Profile;
class TabContentsWrapper;

namespace content {
class WebContents;
}

// There are two different kinds of fullscreen mode - "tab fullscreen" and
// "browser fullscreen". "Tab fullscreen" refers to when a tab enters
// fullscreen mode via the JS fullscreen API, and "browser fullscreen" refers
// to the user putting the browser itself into fullscreen mode from the UI. The
// difference is that tab fullscreen has implications for how the contents of
// the tab render (eg: a video element may grow to consume the whole tab),
// whereas browser fullscreen mode doesn't. Therefore if a user forces an exit
// from tab fullscreen, we need to notify the tab so it can stop rendering in
// its fullscreen mode.

// This class implements fullscreen and mouselock behaviour.
class FullscreenController : public base::RefCounted<FullscreenController> {
 public:
  FullscreenController(BrowserWindow* window,
                       Profile* profile,
                       Browser* browser);

  // Querying.

  // Returns true if the window is currently fullscreen and was initially
  // transitioned to fullscreen by a browser (vs tab) mode transition.
  bool IsFullscreenForBrowser() const;

  // Returns true if fullscreen has been caused by a tab.
  // The window may still be transitioning, and window_->IsFullscreen()
  // may still return false.
  bool IsFullscreenForTabOrPending() const;
  bool IsFullscreenForTabOrPending(const content::WebContents* tab) const;

  bool IsMouseLockRequested() const;
  bool IsMouseLocked() const;

  // Requests.
  void RequestToLockMouse(content::WebContents* tab, bool user_gesture);
  void ToggleFullscreenModeForTab(content::WebContents* tab,
                                  bool enter_fullscreen);
#if defined(OS_MACOSX)
  void TogglePresentationMode();
#endif
  void ToggleFullscreenMode();
  // Extension API implementation uses this method to toggle fullscreen mode.
  // The extension's name is displayed in the full screen bubble UI to attribute
  // the cause of the full screen state change.
  void ToggleFullscreenModeWithExtension(const GURL& extension_url);

  // Notifications.
  void LostMouseLock();
  void OnTabClosing(content::WebContents* web_contents);
  void OnTabDeactivated(TabContentsWrapper* contents);
  void OnAcceptFullscreenPermission(const GURL& url,
                                    FullscreenExitBubbleType bubble_type);
  void OnDenyFullscreenPermission(FullscreenExitBubbleType bubble_type);
  void WindowFullscreenStateChanged();
  bool HandleUserPressedEscape();

  FullscreenExitBubbleType GetFullscreenExitBubbleType() const;

 private:
  friend class base::RefCounted<FullscreenController>;

  enum MouseLockState {
    MOUSELOCK_NOT_REQUESTED,
    // The page requests to lock the mouse and the user hasn't responded to the
    // request.
    MOUSELOCK_REQUESTED,
    // Mouse lock has been allowed by the user.
    MOUSELOCK_ACCEPTED
  };

  virtual ~FullscreenController();

  // Notifies the tab that it has been forced out of fullscreen mode if
  // necessary.
  void NotifyTabOfFullscreenExitIfNecessary();
  // Make the current tab exit fullscreen mode if it is in it.
  void ExitTabbedFullscreenModeIfNecessary();
  void UpdateFullscreenExitBubbleContent();
  void NotifyFullscreenChange();
  ContentSetting GetFullscreenSetting(const GURL& url) const;
  ContentSetting GetMouseLockSetting(const GURL& url) const;

#if defined(OS_MACOSX)
  void TogglePresentationModeInternal(bool for_tab);
#endif
  // TODO(koz): Change |for_tab| to an enum.
  void ToggleFullscreenModeInternal(bool for_tab);

  BrowserWindow* window_;
  Profile* profile_;
  Browser* browser_;

  // If there is currently a tab in fullscreen mode (entered via
  // webkitRequestFullScreen), this is its wrapper.
  TabContentsWrapper* fullscreened_tab_;

  // The URL of the extension which trigerred "browser fullscreen" mode.
  GURL extension_caused_fullscreen_;

  // True if the current tab entered fullscreen mode via webkitRequestFullScreen
  bool tab_caused_fullscreen_;
  // True if tab fullscreen has been allowed, either by settings or by user
  // clicking the allow button on the fullscreen infobar.
  bool tab_fullscreen_accepted_;

  MouseLockState mouse_lock_state_;

  DISALLOW_COPY_AND_ASSIGN(FullscreenController);
};

#endif  // CHROME_BROWSER_UI_FULLSCREEN_CONTROLLER_H_
