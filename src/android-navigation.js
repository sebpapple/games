export function handleAndroidBackButton({ dialog, route, navigateHome, exitApp }) {
  if (dialog) {
    dialog.close();
    return;
  }

  if (route.name === 'game') {
    navigateHome();
    return;
  }

  exitApp();
}
