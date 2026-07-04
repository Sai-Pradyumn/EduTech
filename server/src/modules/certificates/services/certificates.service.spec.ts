import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CertificatesService } from './certificates.service';

/**
 * Revoking a credential must fail closed: a malformed id is treated as "not found" (never
 * a cast-thrown 500), an unknown id 404s, and only a real match flips the revoked flag.
 */
function svc(certs: Record<string, unknown>): CertificatesService {
  return new CertificatesService(certs as never, {} as never, {} as never);
}

describe('CertificatesService.revoke', () => {
  it('rejects a malformed id as not-found without hitting the db', async () => {
    const updateOne = jest.fn();
    await expect(svc({ updateOne }).revoke('not-an-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('404s a well-formed but unknown id', async () => {
    const updateOne = jest.fn().mockReturnValue({
      exec: () => Promise.resolve({ matchedCount: 0 }),
    });
    await expect(
      svc({ updateOne }).revoke(new Types.ObjectId().toHexString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revokes a real certificate', async () => {
    const exec = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const updateOne = jest.fn().mockReturnValue({ exec });
    const id = new Types.ObjectId().toHexString();
    const r = await svc({ updateOne }).revoke(id);
    expect(r).toEqual({ ok: true });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: id },
      { $set: { revoked: true } },
    );
  });
});
