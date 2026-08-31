import { describe, it, expect } from "vitest";
import { assertFetchable, CalendarError, isPrivateAddress } from "./fetchIcs";

/* The calendar URL is the only place a person hands the server an address and
   asks it to go there. These are the checks that keep that from becoming a
   way to read the inside of the network the server sits on. */

describe("addresses the server refuses to visit", () => {
  it("rejects every private and reserved IPv4 range", () => {
    for (const ip of [
      "127.0.0.1", // loopback
      "10.1.2.3", // private
      "172.16.0.1", // private
      "172.31.255.255", // private, top of the range
      "192.168.1.1", // private
      "169.254.169.254", // cloud instance metadata
      "0.0.0.0", // this network
      "100.64.0.1", // carrier-grade NAT
      "198.18.0.1", // benchmarking
      "224.0.0.1", // multicast
      "255.255.255.255", // broadcast
    ]) {
      expect(isPrivateAddress(ip, 4), ip).toBe(true);
    }
  });

  it("allows ordinary public IPv4", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "142.250.74.238", "172.32.0.1"]) {
      expect(isPrivateAddress(ip, 4), ip).toBe(false);
    }
  });

  it("rejects private IPv6, including IPv4 wearing a hat", () => {
    for (const ip of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
    ]) {
      expect(isPrivateAddress(ip, 6), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isPrivateAddress("2606:4700:4700::1111", 6)).toBe(false);
  });

  it("treats a malformed address as private rather than guessing", () => {
    expect(isPrivateAddress("not.an.ip", 4)).toBe(true);
    expect(isPrivateAddress("999.1.1.1", 4)).toBe(true);
  });
});

describe("the URL itself", () => {
  const refuses = async (url: string) =>
    await expect(assertFetchable(url)).rejects.toBeInstanceOf(CalendarError);

  it("insists on https", async () => {
    await refuses("http://example.com/cal.ics");
    await refuses("file:///etc/passwd");
    await refuses("ftp://example.com/cal.ics");
  });

  it("refuses credentials smuggled into the address", async () => {
    await refuses("https://user:pass@example.com/cal.ics");
  });

  it("refuses something that is not a URL", async () => {
    await refuses("just some text");
    await refuses("");
  });

  it("refuses a host that resolves to loopback", async () => {
    // localhost is the shortest path to everything else on the box.
    await refuses("https://localhost/cal.ics");
  });

  it("promotes webcal to https, the way calendar apps hand it out", async () => {
    // Resolution still has to succeed, so this asserts on the scheme alone by
    // checking the failure is about the network rather than the protocol.
    await expect(
      assertFetchable("webcal://localhost/cal.ics"),
    ).rejects.toThrow(/private network|does not resolve/);
  });
});
