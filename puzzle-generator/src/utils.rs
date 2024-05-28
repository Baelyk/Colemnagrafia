use crate::Error;

/// Returns today in days since the Unix Epoch
pub fn today() -> Result<u64, Error> {
    const SECS_IN_DAY: u64 = 60 * 60 * 24;

    let secs = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .or(Err(Error::Message(
            "Error getting duration since Unix epoch".into(),
        )))?
        .as_secs();

    Ok(secs / SECS_IN_DAY)
}
