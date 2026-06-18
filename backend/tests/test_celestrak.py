from app.celestrak import cache_key_for_query, get_record_name, get_record_norad, normalize_record


def test_normalize_record_uppercases_keys() -> None:
    record = normalize_record({"object_name": "SAOCOM-1A", "norad_cat_id": "43641"})

    assert record["OBJECT_NAME"] == "SAOCOM-1A"
    assert record["NORAD_CAT_ID"] == "43641"


def test_record_helpers_extract_name_and_norad() -> None:
    record = {"OBJECT_NAME": "SAOCOM-1B", "NORAD_CAT_ID": "46265"}

    assert get_record_name(record) == "SAOCOM-1B"
    assert get_record_norad(record) == 46265


def test_cache_key_is_stable() -> None:
    left = cache_key_for_query({"FORMAT": "ignored", "CATNR": "43641"})
    right = cache_key_for_query({"CATNR": "43641", "FORMAT": "ignored"})

    assert left == right
