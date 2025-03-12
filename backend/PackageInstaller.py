import subprocess
import sys
import ensurepip

class PackageInstaller:
    def __init__(self, required_packages):
        self.required_packages = required_packages
        self.pip_installed = False

    def ensure_pip(self):
        if not self.pip_installed:
            try:
                __import__('pip')
                print("pip is already installed.")
                self.pip_installed = True
            except ImportError:
                print("pip is not installed. Installing pip...")
                try:
                    ensurepip.bootstrap()
                    print("pip installed successfully.")
                    self.pip_installed = True
                except Exception as e:
                    print(f"Failed to install pip: {e}")
                    sys.exit(1)

    def install_package(self, package):
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
            print(f"Successfully installed {package}")
        except subprocess.CalledProcessError as e:
            print(f"Failed to install {package}: {e}")
            sys.exit(1)

    def install_missing_packages(self):
        self.ensure_pip()
        for package in self.required_packages:
            try:
                __import__(package)
                print(f"'{package}' is already installed.")
            except ImportError:
                print(f"'{package}' is not installed. Installing it now...")
                self.install_package(package)
