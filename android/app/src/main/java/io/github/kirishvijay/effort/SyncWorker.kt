package io.github.kirishvijay.effort

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

// The background sync. If it can't read (no permission yet, or this phone doesn't allow background
// reads), it waits for the next run; opening the app syncs straight away anyway.
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        StepSync.run(applicationContext)
        Result.success()
    } catch (e: SecurityException) {
        Result.success()
    } catch (e: Exception) {
        Result.retry()
    }
}
