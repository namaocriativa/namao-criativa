import {
  DEFAULT_MOVIE_CAMERA,
  DEFAULT_MOVIE_FRAMING,
  MOVIE_CAMERA_IDS,
  MOVIE_FRAMING_IDS,
  isMovieCameraId,
  isMovieFramingId,
  resolveMovieCamera,
  resolveMovieFraming,
} from './movies.direction';

describe('movies.direction', () => {
  it('resolve para plano médio e fixa quando o id falta', () => {
    expect(resolveMovieFraming().id).toBe(DEFAULT_MOVIE_FRAMING);
    expect(resolveMovieCamera().id).toBe(DEFAULT_MOVIE_CAMERA);
    expect(resolveMovieFraming('').id).toBe('plano_medio');
    expect(resolveMovieCamera('zoom').id).toBe('fixa');
  });

  it('devolve a frase de prompt do id escolhido', () => {
    expect(resolveMovieFraming('close').prompt).toContain('rosto preenchendo');
    expect(resolveMovieCamera('dolly_in').prompt).toContain('dolly in');
    expect(resolveMovieFraming('primeiro_plano').prompt).toContain('ombros');
  });

  it('lista só ids válidos', () => {
    expect(MOVIE_FRAMING_IDS).toEqual([
      'plano_geral',
      'plano_medio',
      'close',
      'primeiro_plano',
      'detalhe',
    ]);
    expect(MOVIE_CAMERA_IDS).toContain('orbit');
    expect(isMovieFramingId('plano_medio')).toBe(true);
    expect(isMovieFramingId('wide')).toBe(false);
    expect(isMovieCameraId('fixa')).toBe(true);
    expect(isMovieCameraId('crane')).toBe(false);
  });
});
