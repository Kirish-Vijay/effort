# Credential Manager finds its Google Play services provider by reflection; keep it through minification.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
