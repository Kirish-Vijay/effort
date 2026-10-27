plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.kirishvijay.effort"
    compileSdk = 36
    defaultConfig {
        applicationId = "io.github.kirishvijay.effort"
        minSdk = 26
        targetSdk = 35
        // CI sets VERSION_CODE to the build number, so every build installs over the last one.
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = "1.${System.getenv("VERSION_CODE") ?: "0"}"
    }
    signingConfigs {
        create("release") {
            // The key lives in a GitHub secret; CI writes it to android/release.jks before building.
            storeFile = file("../release.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "effort"
            keyPassword = System.getenv("KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = if (file("../release.jks").exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
