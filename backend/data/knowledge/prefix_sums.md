# Prefix Sums and Difference Arrays

A prefix sum stores cumulative values so a static range sum `[l, r]` is answered as `prefix[r + 1] - prefix[l]`. Build `prefix[0] = 0` and `prefix[i + 1] = prefix[i] + a[i]`; this half-open convention reduces boundary mistakes. Preprocessing is `O(n)` and each range query is `O(1)`.

For many offline range additions, a difference array records `diff[l] += value` and `diff[r + 1] -= value` when that second index exists. One final prefix pass reconstructs the result. Two-dimensional prefix sums use inclusion-exclusion for rectangle queries. Use 64-bit integers when cumulative values can exceed the element type.
